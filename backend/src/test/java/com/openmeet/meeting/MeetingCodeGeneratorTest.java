/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.meeting;

import com.openmeet.modules.meeting.repository.MeetingRepository;
import com.openmeet.modules.meeting.service.MeetingCodeGenerator;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class MeetingCodeGeneratorTest {

    @Test
    void testCodeFormatAndCharset() {
        MeetingRepository mockRepo = Mockito.mock(MeetingRepository.class);
        when(mockRepo.existsByCode(anyString())).thenReturn(false);

        MeetingCodeGenerator generator = new MeetingCodeGenerator(mockRepo);
        String code = generator.generateUniqueCode();

        assertNotNull(code);
        assertEquals(6, code.length());
        assertTrue(code.matches("^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$"), "Code must contain only allowed characters");
    }
}
