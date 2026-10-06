/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.meeting.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "meetings", indexes = {
    @Index(name = "idx_meetings_code", columnList = "code", unique = true)
})
public class Meeting {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", updatable = false, nullable = false, length = 36)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 6)
    private String code;

    @Column(name = "title", nullable = false, length = 120)
    private String title;

    @Column(name = "host_id", nullable = false, length = 64)
    private String hostId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MeetingStatus status = MeetingStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "ended_at")
    private Instant endedAt;

    public Meeting() {}

    public Meeting(UUID id, String code, String title, String hostId, MeetingStatus status, Instant createdAt, Instant endedAt) {
        this.id = id;
        this.code = code;
        this.title = title;
        this.hostId = hostId;
        this.status = status != null ? status : MeetingStatus.ACTIVE;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.endedAt = endedAt;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private UUID id;
        private String code;
        private String title;
        private String hostId;
        private MeetingStatus status = MeetingStatus.ACTIVE;
        private Instant createdAt = Instant.now();
        private Instant endedAt;

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder code(String code) { this.code = code; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder hostId(String hostId) { this.hostId = hostId; return this; }
        public Builder status(MeetingStatus status) { this.status = status; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }
        public Builder endedAt(Instant endedAt) { this.endedAt = endedAt; return this; }

        public Meeting build() {
            return new Meeting(id, code, title, hostId, status, createdAt, endedAt);
        }
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = MeetingStatus.ACTIVE;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getHostId() { return hostId; }
    public void setHostId(String hostId) { this.hostId = hostId; }
    public MeetingStatus getStatus() { return status; }
    public void setStatus(MeetingStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
}
