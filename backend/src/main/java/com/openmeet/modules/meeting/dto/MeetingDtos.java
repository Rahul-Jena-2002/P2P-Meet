/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.meeting.dto;

import java.util.UUID;

public class MeetingDtos {

    public static class CreateRequest {
        private String title;
        private String hostName;

        public CreateRequest() {}
        public CreateRequest(String title, String hostName) {
            this.title = title;
            this.hostName = hostName;
        }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getHostName() { return hostName; }
        public void setHostName(String hostName) { this.hostName = hostName; }
    }

    public static class CreateResponse {
        private UUID meetingId;
        private String code;
        private String title;
        private String hostId;
        private String hostName;
        private String token;

        public CreateResponse() {}
        public CreateResponse(UUID meetingId, String code, String title, String hostId, String hostName, String token) {
            this.meetingId = meetingId;
            this.code = code;
            this.title = title;
            this.hostId = hostId;
            this.hostName = hostName;
            this.token = token;
        }

        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private UUID meetingId;
            private String code;
            private String title;
            private String hostId;
            private String hostName;
            private String token;

            public Builder meetingId(UUID meetingId) { this.meetingId = meetingId; return this; }
            public Builder code(String code) { this.code = code; return this; }
            public Builder title(String title) { this.title = title; return this; }
            public Builder hostId(String hostId) { this.hostId = hostId; return this; }
            public Builder hostName(String hostName) { this.hostName = hostName; return this; }
            public Builder token(String token) { this.token = token; return this; }

            public CreateResponse build() {
                return new CreateResponse(meetingId, code, title, hostId, hostName, token);
            }
        }

        public UUID getMeetingId() { return meetingId; }
        public void setMeetingId(UUID meetingId) { this.meetingId = meetingId; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getHostId() { return hostId; }
        public void setHostId(String hostId) { this.hostId = hostId; }
        public String getHostName() { return hostName; }
        public void setHostName(String hostName) { this.hostName = hostName; }
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
    }

    public static class JoinRequest {
        private String displayName;

        public JoinRequest() {}
        public JoinRequest(String displayName) { this.displayName = displayName; }
        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
    }

    public static class JoinResponse {
        private UUID meetingId;
        private String code;
        private String title;
        private String participantId;
        private String displayName;
        private String role;
        private String token;

        public JoinResponse() {}
        public JoinResponse(UUID meetingId, String code, String title, String participantId, String displayName, String role, String token) {
            this.meetingId = meetingId;
            this.code = code;
            this.title = title;
            this.participantId = participantId;
            this.displayName = displayName;
            this.role = role;
            this.token = token;
        }

        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private UUID meetingId;
            private String code;
            private String title;
            private String participantId;
            private String displayName;
            private String role;
            private String token;

            public Builder meetingId(UUID meetingId) { this.meetingId = meetingId; return this; }
            public Builder code(String code) { this.code = code; return this; }
            public Builder title(String title) { this.title = title; return this; }
            public Builder participantId(String participantId) { this.participantId = participantId; return this; }
            public Builder displayName(String displayName) { this.displayName = displayName; return this; }
            public Builder role(String role) { this.role = role; return this; }
            public Builder token(String token) { this.token = token; return this; }

            public JoinResponse build() {
                return new JoinResponse(meetingId, code, title, participantId, displayName, role, token);
            }
        }

        public UUID getMeetingId() { return meetingId; }
        public void setMeetingId(UUID meetingId) { this.meetingId = meetingId; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getParticipantId() { return participantId; }
        public void setParticipantId(String participantId) { this.participantId = participantId; }
        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
    }

    public static class DetailsResponse {
        private UUID meetingId;
        private String code;
        private String title;
        private String status;
        private String hostId;

        public DetailsResponse() {}
        public DetailsResponse(UUID meetingId, String code, String title, String status, String hostId) {
            this.meetingId = meetingId;
            this.code = code;
            this.title = title;
            this.status = status;
            this.hostId = hostId;
        }

        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private UUID meetingId;
            private String code;
            private String title;
            private String status;
            private String hostId;

            public Builder meetingId(UUID meetingId) { this.meetingId = meetingId; return this; }
            public Builder code(String code) { this.code = code; return this; }
            public Builder title(String title) { this.title = title; return this; }
            public Builder status(String status) { this.status = status; return this; }
            public Builder hostId(String hostId) { this.hostId = hostId; return this; }

            public DetailsResponse build() {
                return new DetailsResponse(meetingId, code, title, status, hostId);
            }
        }

        public UUID getMeetingId() { return meetingId; }
        public void setMeetingId(UUID meetingId) { this.meetingId = meetingId; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getHostId() { return hostId; }
        public void setHostId(String hostId) { this.hostId = hostId; }
    }
}
