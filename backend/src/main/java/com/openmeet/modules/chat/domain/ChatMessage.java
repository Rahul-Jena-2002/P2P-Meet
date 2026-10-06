/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.chat.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_messages", indexes = {
    @Index(name = "idx_cm_meeting_id", columnList = "meeting_id")
})
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", updatable = false, nullable = false, length = 36)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "meeting_id", nullable = false, length = 36)
    private UUID meetingId;

    @Column(name = "sender_id", nullable = false, length = 64)
    private String senderId;

    @Column(name = "sender_name", nullable = false, length = 60)
    private String senderName;

    @Column(name = "content", nullable = false, length = 2000)
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public ChatMessage() {}

    public ChatMessage(UUID id, UUID meetingId, String senderId, String senderName, String content, Instant createdAt) {
        this.id = id;
        this.meetingId = meetingId;
        this.senderId = senderId;
        this.senderName = senderName;
        this.content = content;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private UUID id;
        private UUID meetingId;
        private String senderId;
        private String senderName;
        private String content;
        private Instant createdAt = Instant.now();

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder meetingId(UUID meetingId) { this.meetingId = meetingId; return this; }
        public Builder senderId(String senderId) { this.senderId = senderId; return this; }
        public Builder senderName(String senderName) { this.senderName = senderName; return this; }
        public Builder content(String content) { this.content = content; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }

        public ChatMessage build() {
            return new ChatMessage(id, meetingId, senderId, senderName, content, createdAt);
        }
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getMeetingId() { return meetingId; }
    public void setMeetingId(UUID meetingId) { this.meetingId = meetingId; }
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
