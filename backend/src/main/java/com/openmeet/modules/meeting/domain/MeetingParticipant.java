/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.meeting.domain;

import com.openmeet.modules.auth.domain.ParticipantRole;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "meeting_participants", indexes = {
    @Index(name = "idx_mp_meeting_id", columnList = "meeting_id"),
    @Index(name = "idx_mp_participant_id", columnList = "participant_id")
})
public class MeetingParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", updatable = false, nullable = false, length = 36)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "meeting_id", nullable = false, length = 36)
    private UUID meetingId;

    @Column(name = "participant_id", nullable = false, length = 64)
    private String participantId;

    @Column(name = "display_name", nullable = false, length = 60)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private ParticipantRole role;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt = Instant.now();

    @Column(name = "left_at")
    private Instant leftAt;

    public MeetingParticipant() {}

    public MeetingParticipant(UUID id, UUID meetingId, String participantId, String displayName, ParticipantRole role, Instant joinedAt, Instant leftAt) {
        this.id = id;
        this.meetingId = meetingId;
        this.participantId = participantId;
        this.displayName = displayName;
        this.role = role;
        this.joinedAt = joinedAt != null ? joinedAt : Instant.now();
        this.leftAt = leftAt;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private UUID id;
        private UUID meetingId;
        private String participantId;
        private String displayName;
        private ParticipantRole role;
        private Instant joinedAt = Instant.now();
        private Instant leftAt;

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder meetingId(UUID meetingId) { this.meetingId = meetingId; return this; }
        public Builder participantId(String participantId) { this.participantId = participantId; return this; }
        public Builder displayName(String displayName) { this.displayName = displayName; return this; }
        public Builder role(ParticipantRole role) { this.role = role; return this; }
        public Builder joinedAt(Instant joinedAt) { this.joinedAt = joinedAt; return this; }
        public Builder leftAt(Instant leftAt) { this.leftAt = leftAt; return this; }

        public MeetingParticipant build() {
            return new MeetingParticipant(id, meetingId, participantId, displayName, role, joinedAt, leftAt);
        }
    }

    @PrePersist
    protected void onCreate() {
        if (joinedAt == null) joinedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getMeetingId() { return meetingId; }
    public void setMeetingId(UUID meetingId) { this.meetingId = meetingId; }
    public String getParticipantId() { return participantId; }
    public void setParticipantId(String participantId) { this.participantId = participantId; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public ParticipantRole getRole() { return role; }
    public void setRole(ParticipantRole role) { this.role = role; }
    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }
    public Instant getLeftAt() { return leftAt; }
    public void setLeftAt(Instant leftAt) { this.leftAt = leftAt; }
}
