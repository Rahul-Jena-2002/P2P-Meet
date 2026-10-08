/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.meeting.controller;

import com.openmeet.modules.meeting.dto.MeetingDtos.*;
import com.openmeet.modules.meeting.service.MeetingService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/meetings")
public class MeetingController {

    private static final Pattern CODE_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{3,32}$");

    private final MeetingService meetingService;

    @Value("${openmeet.stun.urls:stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302}")
    private List<String> stunUrls;

    public MeetingController(MeetingService meetingService) {
        this.meetingService = meetingService;
    }

    private boolean isValidCode(String code) {
        return code != null && CODE_PATTERN.matcher(code.trim()).matches();
    }

    @PostMapping
    public ResponseEntity<CreateResponse> createMeeting(@Valid @RequestBody(required = false) CreateRequest request) {
        if (request == null) {
            request = new CreateRequest();
        }
        CreateResponse response = meetingService.createMeeting(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{code}")
    public ResponseEntity<?> getMeeting(@PathVariable String code) {
        if (!isValidCode(code)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid meeting code format"));
        }
        return ResponseEntity.ok(meetingService.getMeetingByCode(code));
    }

    @PostMapping("/{code}/join")
    public ResponseEntity<?> joinMeeting(
            @PathVariable String code,
            @Valid @RequestBody(required = false) JoinRequest request
    ) {
        if (!isValidCode(code)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid meeting code format"));
        }
        if (request == null) {
            request = new JoinRequest();
        }
        return ResponseEntity.ok(meetingService.joinMeeting(code, request));
    }

    @GetMapping("/{code}/ice-servers")
    public ResponseEntity<?> getIceServers(@PathVariable String code) {
        if (!isValidCode(code)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid meeting code format"));
        }
        List<Map<String, Object>> iceServers = List.of(
                Map.of("urls", stunUrls)
        );
        return ResponseEntity.ok(Map.of("iceServers", iceServers));
    }
}
