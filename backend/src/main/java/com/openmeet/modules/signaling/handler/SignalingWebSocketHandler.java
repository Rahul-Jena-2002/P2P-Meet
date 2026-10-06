/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.signaling.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openmeet.modules.auth.domain.ParticipantRole;
import com.openmeet.modules.auth.service.TokenService;
import com.openmeet.modules.chat.domain.ChatMessage;
import com.openmeet.modules.chat.repository.ChatMessageRepository;
import com.openmeet.modules.meeting.domain.Meeting;
import com.openmeet.modules.meeting.domain.MeetingStatus;
import com.openmeet.modules.meeting.repository.MeetingParticipantRepository;
import com.openmeet.modules.meeting.repository.MeetingRepository;
import com.openmeet.modules.signaling.manager.RoomManager;
import com.openmeet.modules.signaling.manager.RoomManager.PeerInfo;
import com.openmeet.modules.signaling.model.SignalEnvelope;
import com.openmeet.modules.signaling.model.SignalType;
import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Instant;
import java.util.*;

@Component
public class SignalingWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SignalingWebSocketHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RoomManager roomManager;
    private final TokenService tokenService;
    private final MeetingRepository meetingRepository;
    private final MeetingParticipantRepository participantRepository;
    private final ChatMessageRepository chatMessageRepository;

    public SignalingWebSocketHandler(
            RoomManager roomManager,
            TokenService tokenService,
            MeetingRepository meetingRepository,
            MeetingParticipantRepository participantRepository,
            ChatMessageRepository chatMessageRepository
    ) {
        this.roomManager = roomManager;
        this.tokenService = tokenService;
        this.meetingRepository = meetingRepository;
        this.participantRepository = participantRepository;
        this.chatMessageRepository = chatMessageRepository;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("WebSocket connected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        SignalEnvelope envelope;
        try {
            envelope = objectMapper.readValue(message.getPayload(), SignalEnvelope.class);
        } catch (Exception e) {
            log.error("Invalid signaling message format: {}", e.getMessage());
            return;
        }

        if (envelope.getType() == null) {
            return;
        }

        String roomId = envelope.getRoomId();

        switch (envelope.getType()) {
            case JOIN_ROOM -> handleJoinRoom(session, envelope);
            case OFFER, ANSWER, ICE_CANDIDATE -> handleDirectPeerSignal(envelope);
            case MEDIA_STATE -> handleMediaState(envelope);
            case CHAT_MESSAGE -> handleChatMessage(envelope);
            case MUTE_PARTICIPANT -> handleMuteParticipant(envelope);
            case KICK_PARTICIPANT -> handleKickParticipant(envelope);
            case END_MEETING -> handleEndMeeting(envelope);
            case CONTROL_REQUEST, CONTROL_APPROVED, CONTROL_DENIED, CONTROL_REVOKED, CONTROL_EVENT -> handleControlSignal(envelope);
            default -> log.warn("Unhandled signal type: {}", envelope.getType());
        }
    }

    private void handleJoinRoom(WebSocketSession session, SignalEnvelope envelope) {
        String roomId = envelope.getRoomId();
        Map<String, Object> payload = envelope.getPayload();
        if (payload == null || !payload.containsKey("token")) {
            sendError(session, "Authentication token required to join room");
            return;
        }

        String token = (String) payload.get("token");
        Claims claims;
        try {
            claims = tokenService.validateAndExtractClaims(token);
        } catch (Exception e) {
            sendError(session, "Invalid or expired token");
            return;
        }

        String participantId = claims.getSubject();
        String displayName = claims.get("displayName", String.class);
        String roleStr = claims.get("role", String.class);
        ParticipantRole role = "HOST".equalsIgnoreCase(roleStr) ? ParticipantRole.HOST : ParticipantRole.PARTICIPANT;

        roomManager.addPeer(roomId, participantId, displayName, role, session);

        // 1. Send ROOM_JOINED back to joining peer with full peers list
        List<Map<String, Object>> peersSummary = roomManager.getPeersSummary(roomId);
        SignalEnvelope joinedEnv = SignalEnvelope.builder()
                .type(SignalType.ROOM_JOINED)
                .roomId(roomId)
                .senderId("server")
                .targetId(participantId)
                .timestamp(System.currentTimeMillis())
                .payload(Map.of(
                        "peers", peersSummary,
                        "yourId", participantId,
                        "yourRole", role.name()
                ))
                .build();
        roomManager.sendToPeer(roomId, participantId, joinedEnv);

        // 2. Notify all other peers about new peer
        SignalEnvelope peerJoinedEnv = SignalEnvelope.builder()
                .type(SignalType.PEER_JOINED)
                .roomId(roomId)
                .senderId(participantId)
                .timestamp(System.currentTimeMillis())
                .payload(Map.of(
                        "peer", Map.of(
                                "participantId", participantId,
                                "displayName", displayName,
                                "role", role.name(),
                                "audioEnabled", true,
                                "videoEnabled", true,
                                "screenSharing", false
                        )
                ))
                .build();
        roomManager.broadcastToRoomExcept(roomId, participantId, peerJoinedEnv);

        // 3. Send past chat history if available
        try {
            Optional<Meeting> meetingOpt = meetingRepository.findByCode(roomId.toUpperCase());
            if (meetingOpt.isPresent()) {
                List<ChatMessage> history = chatMessageRepository.findByMeetingIdOrderByCreatedAtAsc(meetingOpt.get().getId());
                List<Map<String, Object>> msgList = history.stream().map(m -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", m.getId().toString());
                    map.put("senderId", m.getSenderId());
                    map.put("senderName", m.getSenderName());
                    map.put("content", m.getContent());
                    map.put("timestamp", m.getCreatedAt().toEpochMilli());
                    return map;
                }).toList();

                SignalEnvelope historyEnv = SignalEnvelope.builder()
                        .type(SignalType.CHAT_HISTORY)
                        .roomId(roomId)
                        .senderId("server")
                        .targetId(participantId)
                        .timestamp(System.currentTimeMillis())
                        .payload(Map.of("messages", msgList))
                        .build();
                roomManager.sendToPeer(roomId, participantId, historyEnv);
            }
        } catch (Exception e) {
            log.warn("Could not fetch chat history: {}", e.getMessage());
        }
    }

    private void handleDirectPeerSignal(SignalEnvelope envelope) {
        String roomId = envelope.getRoomId();
        String targetId = envelope.getTargetId();
        if (targetId != null) {
            roomManager.sendToPeer(roomId, targetId, envelope);
        }
    }

    private void handleMediaState(SignalEnvelope envelope) {
        String roomId = envelope.getRoomId();
        String senderId = envelope.getSenderId();
        PeerInfo peer = roomManager.getPeer(roomId, senderId);
        if (peer != null && envelope.getPayload() != null) {
            Map<String, Object> p = envelope.getPayload();
            if (p.containsKey("audioEnabled")) peer.setAudioEnabled((Boolean) p.get("audioEnabled"));
            if (p.containsKey("videoEnabled")) peer.setVideoEnabled((Boolean) p.get("videoEnabled"));
            if (p.containsKey("screenSharing")) peer.setScreenSharing((Boolean) p.get("screenSharing"));
        }
        roomManager.broadcastToRoomExcept(roomId, senderId, envelope);
    }

    private void handleChatMessage(SignalEnvelope envelope) {
        String roomId = envelope.getRoomId();
        String senderId = envelope.getSenderId();
        Map<String, Object> payload = envelope.getPayload();
        if (payload != null && payload.containsKey("content")) {
            String content = (String) payload.get("content");
            PeerInfo peer = roomManager.getPeer(roomId, senderId);
            String senderName = peer != null ? peer.getDisplayName() : "Anonymous";

            // Persist to DB asynchronously/safely
            try {
                meetingRepository.findByCode(roomId.toUpperCase()).ifPresent(meeting -> {
                    ChatMessage chatMsg = ChatMessage.builder()
                            .meetingId(meeting.getId())
                            .senderId(senderId)
                            .senderName(senderName)
                            .content(content)
                            .build();
                    chatMessageRepository.save(chatMsg);
                });
            } catch (Exception e) {
                log.warn("Failed to persist chat message: {}", e.getMessage());
            }

            // Broadcast to all participants in room
            envelope.setTimestamp(System.currentTimeMillis());
            roomManager.broadcastToRoom(roomId, envelope);
        }
    }

    private void handleMuteParticipant(SignalEnvelope envelope) {
        String roomId = envelope.getRoomId();
        String senderId = envelope.getSenderId();
        PeerInfo host = roomManager.getPeer(roomId, senderId);
        if (host != null && host.getRole() == ParticipantRole.HOST) {
            String targetId = envelope.getTargetId();
            roomManager.sendToPeer(roomId, targetId, envelope);
        }
    }

    private void handleKickParticipant(SignalEnvelope envelope) {
        String roomId = envelope.getRoomId();
        String senderId = envelope.getSenderId();
        PeerInfo host = roomManager.getPeer(roomId, senderId);
        if (host != null && host.getRole() == ParticipantRole.HOST) {
            String targetId = envelope.getTargetId();
            PeerInfo target = roomManager.getPeer(roomId, targetId);
            if (target != null) {
                roomManager.sendToPeer(roomId, targetId, envelope);
                try {
                    if (target.getSession() != null && target.getSession().isOpen()) {
                        target.getSession().close(new CloseStatus(4001, "Removed by host"));
                    }
                } catch (Exception e) {
                    log.error("Error closing kicked peer session: {}", e.getMessage());
                }
            }
        }
    }

    private void handleEndMeeting(SignalEnvelope envelope) {
        String roomId = envelope.getRoomId();
        String senderId = envelope.getSenderId();
        PeerInfo host = roomManager.getPeer(roomId, senderId);
        if (host != null && host.getRole() == ParticipantRole.HOST) {
            // Update meeting status in DB
            meetingRepository.findByCode(roomId.toUpperCase()).ifPresent(meeting -> {
                meeting.setStatus(MeetingStatus.ENDED);
                meeting.setEndedAt(Instant.now());
                meetingRepository.save(meeting);
            });

            // Broadcast END_MEETING to all
            roomManager.broadcastToRoom(roomId, envelope);
        }
    }

    private void handleControlSignal(SignalEnvelope envelope) {
        String roomId = envelope.getRoomId();
        String targetId = envelope.getTargetId();
        if (targetId != null) {
            roomManager.sendToPeer(roomId, targetId, envelope);
        }
    }

    private void sendError(WebSocketSession session, String errorMsg) {
        try {
            SignalEnvelope env = SignalEnvelope.builder()
                    .type(SignalType.ERROR)
                    .senderId("server")
                    .payload(Map.of("message", errorMsg))
                    .build();
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(env)));
        } catch (Exception e) {
            log.error("Failed to send error message: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = roomManager.getRoomIdForSession(session);
        PeerInfo removed = roomManager.removeSession(session);
        if (removed != null && roomId != null) {
            log.info("Peer {} disconnected from room {}", removed.getDisplayName(), roomId);
            SignalEnvelope peerLeftEnv = SignalEnvelope.builder()
                    .type(SignalType.PEER_LEFT)
                    .roomId(roomId)
                    .senderId(removed.getParticipantId())
                    .timestamp(System.currentTimeMillis())
                    .payload(Map.of(
                            "participantId", removed.getParticipantId(),
                            "displayName", removed.getDisplayName()
                    ))
                    .build();
            roomManager.broadcastToRoom(roomId, peerLeftEnv);
        }
    }
}
