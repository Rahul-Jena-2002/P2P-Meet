/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.auth;

import com.openmeet.modules.auth.domain.ParticipantRole;
import com.openmeet.modules.auth.service.TokenService;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TokenServiceTest {

    private TokenService tokenService;
    private static final String SECRET = "4a7e9b2c8f1d3e5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a";

    @BeforeEach
    void setUp() {
        tokenService = new TokenService(SECRET, 3600000L);
    }

    @Test
    void testGenerateAndValidateHostToken() {
        UUID meetingId = UUID.randomUUID();
        String participantId = "host-12345";
        String displayName = "Alice Host";

        String token = tokenService.generateToken(meetingId, participantId, displayName, ParticipantRole.HOST);
        assertNotNull(token);
        assertFalse(token.isBlank());

        Claims claims = tokenService.validateAndExtractClaims(token);
        assertEquals(participantId, claims.getSubject());
        assertEquals(meetingId.toString(), claims.get("meetingId", String.class));
        assertEquals(displayName, claims.get("displayName", String.class));
        assertEquals("HOST", claims.get("role", String.class));
    }

    @Test
    void testInvalidTokenThrowsSecurityException() {
        assertThrows(SecurityException.class, () -> {
            tokenService.validateAndExtractClaims("invalid.token.structure");
        });
    }
}
