/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.auth.service;

import com.openmeet.modules.auth.domain.ParticipantRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
public class TokenService {

    private final SecretKey key;
    private final long ttlMs;
    private static final String DEFAULT_INSECURE_SECRET = "4a7e9b2c8f1d3e5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a";

    public TokenService(String secret, long ttlMs) {
        this(secret, ttlMs, "dev");
    }

    public TokenService(
            @Value("${openmeet.jwt.secret:}") String secret,
            @Value("${openmeet.jwt.ttl-ms:3600000}") long ttlMs,
            @Value("${spring.profiles.active:dev}") String activeProfile
    ) {
        String effectiveSecret = secret;
        if (effectiveSecret == null || effectiveSecret.isBlank()) {
            if ("prod".equalsIgnoreCase(activeProfile) || "production".equalsIgnoreCase(activeProfile)) {
                throw new IllegalStateException("FATAL: JWT_SECRET environment variable MUST be explicitly set in production!");
            }
            // In dev mode, fall back to default but log severe warning
            org.slf4j.LoggerFactory.getLogger(TokenService.class)
                    .warn("SECURITY WARNING: Using default development JWT secret. Set JWT_SECRET in production.");
            effectiveSecret = DEFAULT_INSECURE_SECRET;
        }

        byte[] keyBytes = effectiveSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("JWT secret must be at least 256 bits (32 bytes) of entropy");
        }

        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.ttlMs = ttlMs;
    }

    public String generateToken(UUID meetingId, String participantId, String displayName, ParticipantRole role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + ttlMs);

        return Jwts.builder()
                .subject(participantId)
                .claim("meetingId", meetingId.toString())
                .claim("displayName", displayName)
                .claim("role", role.name())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public Claims validateAndExtractClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw new SecurityException("Invalid or expired participant token", e);
        }
    }
}
