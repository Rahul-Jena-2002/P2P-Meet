/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.signaling.manager;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openmeet.modules.auth.domain.ParticipantRole;
import com.openmeet.modules.signaling.model.SignalEnvelope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RoomManager {

    private static final Logger log = LoggerFactory.getLogger(RoomManager.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    public static class PeerInfo {
        private String participantId;
        private String displayName;
        private ParticipantRole role;
        private boolean audioEnabled = true;
        private boolean videoEnabled = true;
        private boolean screenSharing = false;
        private WebSocketSession session;

        public PeerInfo(String participantId, String displayName, ParticipantRole role, WebSocketSession session) {
            this.participantId = participantId;
            this.displayName = displayName;
            this.role = role;
            this.session = session;
        }

        public String getParticipantId() { return participantId; }
        public void setParticipantId(String participantId) { this.participantId = participantId; }
        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
        public ParticipantRole getRole() { return role; }
        public void setRole(ParticipantRole role) { this.role = role; }
        public boolean isAudioEnabled() { return audioEnabled; }
        public void setAudioEnabled(boolean audioEnabled) { this.audioEnabled = audioEnabled; }
        public boolean isVideoEnabled() { return videoEnabled; }
        public void setVideoEnabled(boolean videoEnabled) { this.videoEnabled = videoEnabled; }
        public boolean isScreenSharing() { return screenSharing; }
        public void setScreenSharing(boolean screenSharing) { this.screenSharing = screenSharing; }
        public WebSocketSession getSession() { return session; }
        public void setSession(WebSocketSession session) { this.session = session; }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("participantId", participantId);
            map.put("displayName", displayName);
            map.put("role", role != null ? role.name() : "PARTICIPANT");
            map.put("audioEnabled", audioEnabled);
            map.put("videoEnabled", videoEnabled);
            map.put("screenSharing", screenSharing);
            return map;
        }
    }

    // Room Code -> (ParticipantId -> PeerInfo)
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, PeerInfo>> rooms = new ConcurrentHashMap<>();
    // WebSocketSession ID -> (Room Code, ParticipantId)
    private final ConcurrentHashMap<String, Map.Entry<String, String>> sessionMap = new ConcurrentHashMap<>();

    public synchronized void addPeer(String roomId, String participantId, String displayName, ParticipantRole role, WebSocketSession session) {
        rooms.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
        PeerInfo peer = new PeerInfo(participantId, displayName, role, session);
        rooms.get(roomId).put(participantId, peer);
        sessionMap.put(session.getId(), Map.entry(roomId, participantId));
        log.info("Peer {} ({}) joined room {}. Total in room: {}", displayName, participantId, roomId, rooms.get(roomId).size());
    }

    public synchronized PeerInfo removeSession(WebSocketSession session) {
        Map.Entry<String, String> mapping = sessionMap.remove(session.getId());
        if (mapping == null) {
            return null;
        }
        String roomId = mapping.getKey();
        String participantId = mapping.getValue();
        ConcurrentHashMap<String, PeerInfo> roomPeers = rooms.get(roomId);
        if (roomPeers != null) {
            PeerInfo removed = roomPeers.remove(participantId);
            if (roomPeers.isEmpty()) {
                rooms.remove(roomId);
                log.info("Room {} is now empty and removed.", roomId);
            }
            return removed;
        }
        return null;
    }

    public String getRoomIdForSession(WebSocketSession session) {
        Map.Entry<String, String> mapping = sessionMap.get(session.getId());
        return mapping != null ? mapping.getKey() : null;
    }

    public List<Map<String, Object>> getPeersSummary(String roomId) {
        ConcurrentHashMap<String, PeerInfo> roomPeers = rooms.get(roomId);
        if (roomPeers == null) return Collections.emptyList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (PeerInfo peer : roomPeers.values()) {
            list.add(peer.toMap());
        }
        return list;
    }

    public PeerInfo getPeer(String roomId, String participantId) {
        ConcurrentHashMap<String, PeerInfo> roomPeers = rooms.get(roomId);
        return roomPeers != null ? roomPeers.get(participantId) : null;
    }

    public void sendToPeer(String roomId, String targetId, SignalEnvelope envelope) {
        PeerInfo target = getPeer(roomId, targetId);
        if (target != null && target.getSession() != null && target.getSession().isOpen()) {
            sendMessage(target.getSession(), envelope);
        } else {
            log.warn("Target peer {} not found in room {} or session closed", targetId, roomId);
        }
    }

    public void broadcastToRoom(String roomId, SignalEnvelope envelope) {
        ConcurrentHashMap<String, PeerInfo> roomPeers = rooms.get(roomId);
        if (roomPeers != null) {
            for (PeerInfo peer : roomPeers.values()) {
                if (peer.getSession() != null && peer.getSession().isOpen()) {
                    sendMessage(peer.getSession(), envelope);
                }
            }
        }
    }

    public void broadcastToRoomExcept(String roomId, String exceptParticipantId, SignalEnvelope envelope) {
        ConcurrentHashMap<String, PeerInfo> roomPeers = rooms.get(roomId);
        if (roomPeers != null) {
            for (PeerInfo peer : roomPeers.values()) {
                if (!peer.getParticipantId().equals(exceptParticipantId)) {
                    if (peer.getSession() != null && peer.getSession().isOpen()) {
                        sendMessage(peer.getSession(), envelope);
                    }
                }
            }
        }
    }

    private void sendMessage(WebSocketSession session, SignalEnvelope envelope) {
        try {
            synchronized (session) {
                if (session.isOpen()) {
                    String json = objectMapper.writeValueAsString(envelope);
                    session.sendMessage(new TextMessage(json));
                }
            }
        } catch (IOException e) {
            log.error("Failed to send WebSocket message to session {}: {}", session.getId(), e.getMessage());
        }
    }
}
