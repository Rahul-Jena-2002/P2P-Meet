/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.meeting.controller;

import com.openmeet.modules.meeting.dto.MeetingDtos.*;
import com.openmeet.modules.meeting.service.MeetingService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/meetings")
@CrossOrigin(origins = "*")
public class MeetingController {

    private final MeetingService meetingService;

    @Value("${openmeet.stun.urls:stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302}")
    private List<String> stunUrls;

    public MeetingController(MeetingService meetingService) {
        this.meetingService = meetingService;
    }

    @PostMapping
    public ResponseEntity<CreateResponse> createMeeting(@RequestBody(required = false) CreateRequest request) {
        if (request == null) {
            request = new CreateRequest();
        }
        CreateResponse response = meetingService.createMeeting(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{code}")
    public ResponseEntity<DetailsResponse> getMeeting(@PathVariable String code) {
        return ResponseEntity.ok(meetingService.getMeetingByCode(code));
    }

    @PostMapping("/{code}/join")
    public ResponseEntity<JoinResponse> joinMeeting(
            @PathVariable String code,
            @RequestBody(required = false) JoinRequest request
    ) {
        if (request == null) {
            request = new JoinRequest();
        }
        return ResponseEntity.ok(meetingService.joinMeeting(code, request));
    }

    @GetMapping("/{code}/ice-servers")
    public ResponseEntity<Map<String, Object>> getIceServers(@PathVariable String code) {
        List<Map<String, Object>> iceServers = List.of(
                Map.of("urls", stunUrls)
        );
        return ResponseEntity.ok(Map.of("iceServers", iceServers));
    }
}
