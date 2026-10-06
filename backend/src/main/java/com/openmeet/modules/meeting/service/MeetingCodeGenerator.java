/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.meeting.service;

import com.openmeet.modules.meeting.repository.MeetingRepository;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
public class MeetingCodeGenerator {

    private static final String CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 10;

    private final SecureRandom random = new SecureRandom();
    private final MeetingRepository meetingRepository;

    public MeetingCodeGenerator(MeetingRepository meetingRepository) {
        this.meetingRepository = meetingRepository;
    }

    public String generateUniqueCode() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                int index = random.nextInt(CHARSET.length());
                sb.append(CHARSET.charAt(index));
            }
            String candidate = sb.toString();
            if (!meetingRepository.existsByCode(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Failed to generate a unique meeting code after maximum attempts");
    }
}
