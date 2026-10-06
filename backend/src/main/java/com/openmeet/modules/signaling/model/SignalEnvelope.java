/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.signaling.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SignalEnvelope {
    private SignalType type;
    private String roomId;
    private String senderId;
    private String targetId;
    private Long timestamp;
    private Map<String, Object> payload;

    public SignalEnvelope() {}

    public SignalEnvelope(SignalType type, String roomId, String senderId, String targetId, Long timestamp, Map<String, Object> payload) {
        this.type = type;
        this.roomId = roomId;
        this.senderId = senderId;
        this.targetId = targetId;
        this.timestamp = timestamp;
        this.payload = payload;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private SignalType type;
        private String roomId;
        private String senderId;
        private String targetId;
        private Long timestamp;
        private Map<String, Object> payload;

        public Builder type(SignalType type) { this.type = type; return this; }
        public Builder roomId(String roomId) { this.roomId = roomId; return this; }
        public Builder senderId(String senderId) { this.senderId = senderId; return this; }
        public Builder targetId(String targetId) { this.targetId = targetId; return this; }
        public Builder timestamp(Long timestamp) { this.timestamp = timestamp; return this; }
        public Builder payload(Map<String, Object> payload) { this.payload = payload; return this; }

        public SignalEnvelope build() {
            return new SignalEnvelope(type, roomId, senderId, targetId, timestamp, payload);
        }
    }

    public SignalType getType() { return type; }
    public void setType(SignalType type) { this.type = type; }
    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    public String getTargetId() { return targetId; }
    public void setTargetId(String targetId) { this.targetId = targetId; }
    public Long getTimestamp() { return timestamp; }
    public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
    public Map<String, Object> getPayload() { return payload; }
    public void setPayload(Map<String, Object> payload) { this.payload = payload; }
}
