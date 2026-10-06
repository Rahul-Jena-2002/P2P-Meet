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

    public TokenService(
            @Value("${openmeet.jwt.secret:4a7e9b2c8f1d3e5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a}") String secret,
            @Value("${openmeet.jwt.ttl-ms:3600000}") long ttlMs
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
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
