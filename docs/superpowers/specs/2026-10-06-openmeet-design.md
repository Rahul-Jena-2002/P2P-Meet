# OpenMeet Design Specification

**Date:** 2026-10-06
**License:** AGPLv3
**Status:** Approved for implementation

---

## 1. Product Summary

OpenMeet is a lightweight, open-source, self-hostable video meeting application. It is not a Zoom clone; it is a clean, privacy-friendly, P2P-first alternative for individuals, developers, small teams, classrooms, and support sessions.

**Core promise:** Create a meeting, share the link, join instantly, communicate through video/audio/chat, share your screen, and optionally allow another participant to control your computer.

**V1 target:** 2-6 participants per room, 720p video, WebRTC mesh (no SFU).

---

## 2. Non-Goals (V1)

- AI summaries, transcription, assistants
- Calendar/Outlook/Google Calendar integration
- Enterprise SSO, corporate directory
- File storage, whiteboard, PowerPoint collaboration
- Server-side recording or cloud video storage
- Large webinar functionality (>6 participants)
- Phone/PSTN calling
- Mobile native applications
- Screen control without explicit user permission
- Server-side media processing

---

## 3. Monorepo Structure

```
openmeet/
├── apps/
│   ├── web/                  # React + TypeScript + Vite + Tailwind + shadcn/ui
│   └── desktop-agent/        # Rust + Tauri
├── services/
│   └── backend/              # Java 21 + Spring Boot
├── infra/
│   ├── docker/
│   ├── nginx/
│   └── coturn/
├── docs/
│   ├── superpowers/
│   │   ├── specs/
│   │   └── plans/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── PROTOCOL.md
│   └── SECURITY.md
├── docker-compose.yml
├── LICENSE                   # AGPLv3
└── README.md
```

---

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript 5 |
| Build tool | Vite 5 |
| Styling | Tailwind CSS v3 |
| UI components | shadcn/ui |
| State management | Zustand 4 |
| Media | WebRTC (browser native) |
| Screen sharing | getDisplayMedia() (browser native) |
| Signaling | WebSocket (raw, not STOMP) |
| Backend language | Java 21 |
| Backend framework | Spring Boot 3 |
| Backend modules | Spring Web, Spring WebSocket, Spring Security, Spring Data JPA |
| Database | PostgreSQL 16 |
| TURN server | Coturn |
| Reverse proxy | Caddy (or Nginx + Let us Encrypt) |
| Deployment | Docker Compose |
| Frontend hosting | Cloudflare Pages |
| Backend hosting | Oracle Cloud VM |
| Desktop control agent | Rust + Tauri |
| Desktop input injection | enigo crate |
| License | AGPLv3 |

---

## 5. Database Schema

```sql
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(100) NOT NULL,
    email        VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE meetings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(10) UNIQUE NOT NULL,
    host_id    UUID REFERENCES users(id),
    status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at   TIMESTAMPTZ
);

CREATE TABLE meeting_participants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id        UUID NOT NULL REFERENCES meetings(id),
    user_id           UUID REFERENCES users(id),
    display_name      VARCHAR(100) NOT NULL,
    participant_token VARCHAR(512) NOT NULL,
    role              VARCHAR(20) NOT NULL,
    joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at           TIMESTAMPTZ
);

CREATE TABLE chat_messages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id     UUID NOT NULL REFERENCES meetings(id),
    participant_id UUID NOT NULL REFERENCES meeting_participants(id),
    message        TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Not stored in PostgreSQL: SDP, ICE candidates, live room state, video/audio data.

---

## 6. Backend Architecture

### 6.1 Package Structure

```
com.openmeet/
├── config/
│   ├── SecurityConfig.java
│   ├── WebSocketConfig.java
│   └── CorsConfig.java
├── controller/
│   ├── MeetingController.java
│   └── TurnCredentialController.java
├── websocket/
│   ├── MeetingWebSocketHandler.java
│   ├── SignalingService.java
│   └── RoomStateService.java
├── service/
│   ├── MeetingService.java
│   ├── ParticipantService.java
│   └── ChatService.java
├── repository/
│   ├── MeetingRepository.java
│   ├── MeetingParticipantRepository.java
│   └── ChatMessageRepository.java
├── domain/
│   ├── Meeting.java
│   ├── MeetingParticipant.java
│   ├── ChatMessage.java
│   └── User.java
├── dto/
│   ├── CreateMeetingResponse.java
│   ├── JoinMeetingRequest.java
│   ├── JoinMeetingResponse.java
│   ├── WsEnvelope.java
│   └── TurnCredentials.java
├── security/
│   ├── GuestTokenService.java
│   └── ControlAuthorizationService.java
└── exception/
    └── GlobalExceptionHandler.java
```

### 6.2 REST API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/meetings | None | Create meeting |
| GET | /api/v1/meetings/{code} | None | Get meeting info |
| POST | /api/v1/meetings/{code}/join | None | Join meeting, returns participantToken |
| POST | /api/v1/meetings/{code}/end | HOST token | End meeting |
| GET | /api/v1/turn-credentials | participant token | Time-limited TURN credentials |

### 6.3 WebSocket Envelope

```json
{
  "type": "EVENT_NAME",
  "roomId": "7FK9A2",
  "senderId": "p_abc123",
  "timestamp": 1720000000000,
  "payload": {}
}
```

### 6.4 In-Memory Room State

```java
class Room {
    String code;
    String hostParticipantId;
    Map<String, WebSocketSession> sessions;
    Map<String, ParticipantInfo> participants;
    String screenSharerParticipantId;
    ControlState controlState;
}
```

### 6.5 WebSocket Events

```
JOIN_ROOM            Client -> Server
LEAVE_ROOM           Client -> Server
PEER_JOINED          Server -> Others
PEER_LEFT            Server -> Others
SDP_OFFER            Relayed (targetId in payload)
SDP_ANSWER           Relayed (targetId in payload)
ICE_CANDIDATE        Relayed (targetId in payload)
MUTE_CHANGED         Client -> Broadcast
CAMERA_CHANGED       Client -> Broadcast
SCREEN_SHARE_STARTED Broadcast
SCREEN_SHARE_STOPPED Broadcast
CHAT_MESSAGE         Client -> Persist -> Broadcast
RAISE_HAND           Broadcast
LOWER_HAND           Broadcast
REMOTE_CONTROL_REQUEST    Client -> sharer
REMOTE_CONTROL_APPROVED   Server -> requester (includes control token)
REMOTE_CONTROL_DENIED     Server -> requester
REMOTE_CONTROL_REVOKED    Server -> all
PARTICIPANT_REMOVED  Server -> target
PARTICIPANT_MUTED    Server -> target + broadcast
MEETING_ENDED        Server -> all
```

---

## 7. Frontend Architecture

### 7.1 Directory Structure

```
apps/web/src/
├── components/
│   ├── meeting/
│   │   ├── VideoGrid.tsx
│   │   ├── VideoTile.tsx
│   │   ├── Toolbar.tsx
│   │   └── ScreenShareView.tsx
│   ├── sidebar/
│   │   ├── ChatPanel.tsx
│   │   └── ParticipantsPanel.tsx
│   ├── lobby/
│   │   └── LobbyForm.tsx
│   └── ui/
├── pages/
│   ├── HomePage.tsx
│   ├── MeetingPage.tsx
│   └── NotFoundPage.tsx
├── hooks/
│   ├── useMeeting.ts
│   ├── useWebRTC.ts
│   ├── useSignaling.ts
│   └── useMedia.ts
├── services/
│   ├── api/meetingApi.ts
│   ├── media/MediaService.ts
│   ├── signaling/SignalingService.ts
│   └── webrtc/WebRTCService.ts
├── stores/
│   ├── meetingStore.ts
│   └── mediaStore.ts
└── types/index.ts
```

### 7.2 Routes

```
/         -> HomePage
/m/:code  -> MeetingPage (LobbyForm -> Room)
*         -> NotFoundPage
```

### 7.3 Zustand Stores

meetingStore: meetingCode, meetingId, myParticipantId, myRole, participants, chatMessages, sidebarPanel, screenSharerId, controlState

mediaStore: localStream, isMuted, isCameraOn, isScreenSharing, screenStream

### 7.4 WebRTC Mesh Flow

1. PEER_JOINED received -> existing peers create RTCPeerConnection for new peer
2. Add local tracks, create SDP_OFFER, send via signaling
3. New peer receives offers, creates RTCPeerConnection, sends SDP_ANSWER
4. ICE_CANDIDATE events exchanged
5. ontrack fires -> VideoTile renders remote stream

### 7.5 TURN Config

Frontend fetches /api/v1/turn-credentials on join.
ICE servers: stun:turn.example.com:3478 + turn:turn.example.com:3478 with credentials.

---

## 8. Screen Sharing

Flow: Share Screen clicked -> getDisplayMedia() -> OS picker -> stream added to peer connections -> SCREEN_SHARE_STARTED broadcast -> ScreenShareView rendered for others

States: IDLE -> REQUESTED -> ACTIVE -> STOPPED

Constraint: One participant sharing at a time in V1.

---

## 9. Host Controls

| Action | Mechanism | Backend validation |
|--------|-----------|-------------------|
| Mute participant | WS: PARTICIPANT_MUTED | Token role = HOST |
| Remove participant | WS: PARTICIPANT_REMOVED | Token role = HOST |
| End meeting | REST: POST /meetings/{code}/end | Token role = HOST |

---

## 10. Remote Control

### 10.1 State Machine

```
NONE -> REQUESTED -> AUTHORIZED -> ACTIVE -> NONE
         deny->NONE    timeout->NONE  revoke->NONE
```

### 10.2 Control Token

On approval: UUID token scoped to (meetingId, controllerId, sharerId), TTL 1 hour, stored in memory.

### 10.3 Desktop Agent

```
apps/desktop-agent/src/
├── main.rs          # Tauri bootstrap, system tray
├── websocket.rs     # Connect to wss://backend/ws/control
├── input_handler.rs # Translate events -> OS input via enigo
├── state.rs         # ControlState machine
└── security.rs      # Token validation, TTL, revoke
```

Accepted events only: mouse_move, mouse_down, mouse_up, mouse_wheel, key_down, key_up.
All other events are rejected and logged.

### 10.4 Always-Visible Banner

When ACTIVE: "CONTROL ACTIVE - Alex is controlling your computer. [TAKE BACK CONTROL]"
Cannot be hidden. Persists until revoked.

### 10.5 Security Rules

1. Explicit request required
2. Explicit approval required
3. Short-lived scoped control token (1h TTL)
4. No control when screen share is not ACTIVE
5. Agent rejects events after token expiry or revocation
6. Immediate revoke via REMOTE_CONTROL_REVOKED
7. Meeting end auto-revokes all control sessions
8. No shell command execution ever

---

## 11. TURN Credential Issuance

RFC 5766-style HMAC-SHA1:
```
username = timestamp:participantId
password = HMAC-SHA1(turnSecret, username)
TTL = 24 hours
```

---

## 12. Authentication (V1 - Guest Only)

User provides display name. Backend issues participant JWT:
{ participantId, meetingId, role, exp (1 hour) }
Signed with server-side secret. Used in REST headers and WS JOIN_ROOM payload.

---

## 13. Meeting Codes

6-character alphanumeric from charset ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (avoids 0/O/I/1).
Generated via SecureRandom. ~32.7 bits of entropy.

---

## 14. Docker Compose (Development)

```yaml
services:
  backend:
    build: ./services/backend
    ports: ["8080:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/openmeet
      JWT_SECRET: ${JWT_SECRET}
      TURN_SECRET: ${TURN_SECRET}
    depends_on: [db]

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: openmeet
      POSTGRES_USER: openmeet
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]

  coturn:
    image: coturn/coturn
    network_mode: host
    volumes: [./infra/coturn/turnserver.conf:/etc/coturn/turnserver.conf]

volumes:
  pgdata:
```

---

## 15. Production Deployment

```
Cloudflare Pages -> apps/web (static)

Oracle Cloud VM
  Caddy (TLS via Let us Encrypt)
    api.example.com -> Spring Boot :8080
  Coturn (ports 3478 UDP/TCP, 5349 TLS)
  PostgreSQL (internal only)

DNS (Cloudflare):
  meet.example.com -> Cloudflare Pages
  api.example.com  -> Oracle VM IP
  turn.example.com -> Oracle VM IP
```

---

## 16. Observability

Logged: meeting.created, participant.joined/left, ws.connected/disconnected, webrtc.state_change, ice.state_change, screen_share.started/stopped, control.requested/approved/denied/revoked

Never logged: video/audio data, chat content, keyboard values, mouse positions.

---

## 17. Development Phases

### Phase 1 - Foundation
Monorepo scaffold, React + Vite frontend, Spring Boot + PostgreSQL backend, Docker Compose.
REST endpoints: POST /meetings, GET /meetings/{code}, POST /meetings/{code}/join.
Guest token issuance. Landing page + lobby form (no WebRTC yet).

### Phase 2 - WebRTC and Signaling
WebSocket /ws endpoint. JOIN_ROOM/LEAVE_ROOM/PEER_JOINED/PEER_LEFT.
SDP offer/answer relay. ICE candidate relay.
WebRTCService + SignalingService in frontend. TURN credentials + Coturn.
Camera + microphone between 2+ participants.

### Phase 3 - Meeting UI
VideoGrid, VideoTile, Toolbar. ChatPanel + ParticipantsPanel sidebar.
CHAT_MESSAGE (persist + broadcast). MUTE_CHANGED/CAMERA_CHANGED. RAISE_HAND/LOWER_HAND.

### Phase 4 - Screen Sharing
getDisplayMedia(). ScreenShareView overlay. SCREEN_SHARE_STARTED/STOPPED.
Screen track replacement. Presenter stop sharing. Browser ended event handling.

### Phase 5 - Host Controls
PARTICIPANT_MUTED. PARTICIPANT_REMOVED. POST /meetings/{code}/end.
MEETING_ENDED broadcast. Host controls in ParticipantsPanel. Role enforcement in backend.

### Phase 6 - Desktop Control Agent
Rust + Tauri agent. ControlAuthorizationService. Remote control state machine.
Control token issuance. /ws/control endpoint. input_handler.rs with enigo.
Request/approval browser UI. Take Back Control banner. Revocation. Windows + Linux.

### Phase 7 - Production Hardening
HTTPS + WSS via Caddy. Rate limiting. Health checks. Structured logging.
Environment variable config. Multi-stage Docker builds. Cloudflare Pages pipeline.
Coturn TLS. README self-hosting guide. docker-compose.prod.yml.

---

## 18. MVP Acceptance Criteria

- 4 participants can join and see/hear each other
- Mic and camera toggles work
- Screen sharing works end-to-end
- Chat messages appear in order with sender and timestamp
- Host can mute, remove participants, and end meeting
- Remote control: request -> approve -> mouse/keyboard work -> revoke
- docker-compose up starts the entire system
- Frontend deployable to Cloudflare Pages
- Backend deployable to Oracle VM with HTTPS + WSS
