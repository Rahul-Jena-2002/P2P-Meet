/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.meeting;

import com.openmeet.modules.auth.domain.ParticipantRole;
import com.openmeet.modules.auth.service.TokenService;
import com.openmeet.modules.meeting.domain.Meeting;
import com.openmeet.modules.meeting.domain.MeetingStatus;
import com.openmeet.modules.meeting.dto.MeetingDtos.*;
import com.openmeet.modules.meeting.repository.MeetingParticipantRepository;
import com.openmeet.modules.meeting.repository.MeetingRepository;
import com.openmeet.modules.meeting.service.MeetingCodeGenerator;
import com.openmeet.modules.meeting.service.MeetingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class MeetingServiceTest {

    private MeetingRepository meetingRepository;
    private MeetingParticipantRepository participantRepository;
    private MeetingCodeGenerator codeGenerator;
    private TokenService tokenService;
    private MeetingService meetingService;

    @BeforeEach
    void setUp() {
        meetingRepository = Mockito.mock(MeetingRepository.class);
        participantRepository = Mockito.mock(MeetingParticipantRepository.class);
        codeGenerator = Mockito.mock(MeetingCodeGenerator.class);
        tokenService = Mockito.mock(TokenService.class);
        meetingService = new MeetingService(meetingRepository, participantRepository, codeGenerator, tokenService);
    }

    @Test
    void testCreateMeeting() {
        when(codeGenerator.generateUniqueCode()).thenReturn("AB34EF");
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(i -> {
            Meeting m = i.getArgument(0);
            m.setId(UUID.randomUUID());
            return m;
        });
        when(tokenService.generateToken(any(), any(), any(), eq(ParticipantRole.HOST))).thenReturn("mock-host-jwt");

        CreateRequest req = new CreateRequest("Standup", "Bob");
        CreateResponse res = meetingService.createMeeting(req);

        assertNotNull(res);
        assertEquals("AB34EF", res.getCode());
        assertEquals("Standup", res.getTitle());
        assertEquals("Bob", res.getHostName());
        assertEquals("mock-host-jwt", res.getToken());
    }

    @Test
    void testJoinMeeting() {
        UUID meetingId = UUID.randomUUID();
        Meeting meeting = Meeting.builder()
                .id(meetingId)
                .code("AB34EF")
                .title("Standup")
                .status(MeetingStatus.ACTIVE)
                .hostId("host-1")
                .build();

        when(meetingRepository.findByCode("AB34EF")).thenReturn(Optional.of(meeting));
        when(tokenService.generateToken(eq(meetingId), any(), eq("Charlie"), eq(ParticipantRole.PARTICIPANT))).thenReturn("mock-guest-jwt");

        JoinRequest req = new JoinRequest("Charlie");
        JoinResponse res = meetingService.joinMeeting("AB34EF", req);

        assertNotNull(res);
        assertEquals(meetingId, res.getMeetingId());
        assertEquals("AB34EF", res.getCode());
        assertEquals("Charlie", res.getDisplayName());
        assertEquals("PARTICIPANT", res.getRole());
        assertEquals("mock-guest-jwt", res.getToken());
    }
}
