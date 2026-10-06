/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.meeting.service;

import com.openmeet.modules.auth.domain.ParticipantRole;
import com.openmeet.modules.auth.service.TokenService;
import com.openmeet.modules.meeting.domain.Meeting;
import com.openmeet.modules.meeting.domain.MeetingParticipant;
import com.openmeet.modules.meeting.domain.MeetingStatus;
import com.openmeet.modules.meeting.dto.MeetingDtos.*;
import com.openmeet.modules.meeting.repository.MeetingParticipantRepository;
import com.openmeet.modules.meeting.repository.MeetingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class MeetingService {

    private final MeetingRepository meetingRepository;
    private final MeetingParticipantRepository participantRepository;
    private final MeetingCodeGenerator codeGenerator;
    private final TokenService tokenService;

    public MeetingService(
            MeetingRepository meetingRepository,
            MeetingParticipantRepository participantRepository,
            MeetingCodeGenerator codeGenerator,
            TokenService tokenService
    ) {
        this.meetingRepository = meetingRepository;
        this.participantRepository = participantRepository;
        this.codeGenerator = codeGenerator;
        this.tokenService = tokenService;
    }

    @Transactional
    public CreateResponse createMeeting(CreateRequest req) {
        String code = codeGenerator.generateUniqueCode();
        String hostId = "host-" + UUID.randomUUID().toString().substring(0, 8);
        String hostName = (req.getHostName() != null && !req.getHostName().isBlank())
                ? req.getHostName().trim()
                : "Host";
        String title = (req.getTitle() != null && !req.getTitle().isBlank())
                ? req.getTitle().trim()
                : "Instant Meeting";

        Meeting meeting = Meeting.builder()
                .code(code)
                .title(title)
                .hostId(hostId)
                .status(MeetingStatus.ACTIVE)
                .build();

        Meeting saved = meetingRepository.save(meeting);

        // Record host participant
        MeetingParticipant hostParticipant = MeetingParticipant.builder()
                .meetingId(saved.getId())
                .participantId(hostId)
                .displayName(hostName)
                .role(ParticipantRole.HOST)
                .build();
        participantRepository.save(hostParticipant);

        String token = tokenService.generateToken(saved.getId(), hostId, hostName, ParticipantRole.HOST);

        return CreateResponse.builder()
                .meetingId(saved.getId())
                .code(saved.getCode())
                .title(saved.getTitle())
                .hostId(hostId)
                .hostName(hostName)
                .token(token)
                .build();
    }

    @Transactional(readOnly = true)
    public DetailsResponse getMeetingByCode(String code) {
        Meeting meeting = meetingRepository.findByCode(code.toUpperCase().trim())
                .orElseThrow(() -> new IllegalArgumentException("Meeting not found with code: " + code));

        return DetailsResponse.builder()
                .meetingId(meeting.getId())
                .code(meeting.getCode())
                .title(meeting.getTitle())
                .status(meeting.getStatus().name())
                .hostId(meeting.getHostId())
                .build();
    }

    @Transactional
    public JoinResponse joinMeeting(String code, JoinRequest req) {
        Meeting meeting = meetingRepository.findByCode(code.toUpperCase().trim())
                .orElseThrow(() -> new IllegalArgumentException("Meeting not found with code: " + code));

        if (meeting.getStatus() == MeetingStatus.ENDED) {
            throw new IllegalStateException("Meeting has already ended");
        }

        String displayName = (req.getDisplayName() != null && !req.getDisplayName().isBlank())
                ? req.getDisplayName().trim()
                : "Participant";
        String participantId = "peer-" + UUID.randomUUID().toString().substring(0, 8);

        MeetingParticipant participant = MeetingParticipant.builder()
                .meetingId(meeting.getId())
                .participantId(participantId)
                .displayName(displayName)
                .role(ParticipantRole.PARTICIPANT)
                .build();
        participantRepository.save(participant);

        String token = tokenService.generateToken(meeting.getId(), participantId, displayName, ParticipantRole.PARTICIPANT);

        return JoinResponse.builder()
                .meetingId(meeting.getId())
                .code(meeting.getCode())
                .title(meeting.getTitle())
                .participantId(participantId)
                .displayName(displayName)
                .role(ParticipantRole.PARTICIPANT.name())
                .token(token)
                .build();
    }

    @Transactional
    public void endMeeting(UUID meetingId, String requesterId) {
        Meeting meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new IllegalArgumentException("Meeting not found"));

        if (!meeting.getHostId().equals(requesterId)) {
            throw new SecurityException("Only the host can end the meeting");
        }

        meeting.setStatus(MeetingStatus.ENDED);
        meeting.setEndedAt(Instant.now());
        meetingRepository.save(meeting);
    }
}
