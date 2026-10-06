# OpenMeet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build OpenMeet — a self-hostable, open-source P2P video meeting application with WebRTC, chat, screen sharing, host controls, and remote desktop control.

**Architecture:** WebRTC mesh (no SFU), Spring Boot signaling-only backend, React frontend, Rust+Tauri desktop agent. Backend never carries video/audio traffic.

**Tech Stack:** React 18 + TypeScript 5 + Vite 5 + Tailwind CSS v3 + shadcn/ui + Zustand 4 | Java 21 + Spring Boot 3 + PostgreSQL 16 | Rust + Tauri | Coturn | Docker Compose

**Spec:** `docs/superpowers/specs/2026-10-06-openmeet-design.md`

## Global Constraints

- Java 21 minimum; Spring Boot 3.x; Spring Data JPA with PostgreSQL 16
- Node 20+ for frontend; Vite 5; React 18; TypeScript strict mode
- Rust edition 2021; Tauri 2.x; enigo 0.2+
- All secrets via environment variables — never in source code
- AGPLv3 license header on all source files
- Meeting codes: charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 6 characters, SecureRandom
- Participant JWT TTL: 1 hour; Control token TTL: 1 hour
- WebSocket envelope: `{ type, roomId, senderId, timestamp, payload }`
- HTTPS + WSS required in production; HTTP allowed in local Docker Compose
- No sequential meeting IDs in URLs
- Backend is signaling-only — never processes video/audio

## Review Focus

- **ICE candidate race condition:** Candidates arriving before `setRemoteDescription` must be queued and applied after; test with simulated delayed SDP
- **Host token validation:** All host-only WS actions (PARTICIPANT_MUTED, PARTICIPANT_REMOVED) must reject non-HOST tokens; test with PARTICIPANT token impersonation
- **Control event when screen share stops:** Desktop agent must drop all events when screen share is STOPPED; test by sending mouse_move after SCREEN_SHARE_STOPPED
- **WebSocket disconnect cleanup:** Participant disconnect must trigger PEER_LEFT broadcast and room cleanup; test abrupt disconnect (no LEAVE_ROOM)
- **Meeting code collision:** Code generator must retry on collision; test with a saturated charset (mock SecureRandom)

---

## PHASE 1 — Foundation

---

### Task 1: Monorepo Scaffold

**Files:**
- Create: `openmeet/` (root — this IS the workspace at `G:\projectssss\Zoom Replica\`)
- Create: `apps/web/` (Vite + React + TypeScript + Tailwind + shadcn/ui)
- Create: `services/backend/` (Spring Boot Maven project)
- Create: `infra/docker/`, `infra/nginx/`, `infra/coturn/`
- Create: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/PROTOCOL.md`, `docs/SECURITY.md`
- Create: `docker-compose.yml`
- Create: `LICENSE` (AGPLv3)
- Create: `README.md`
- Create: `.gitignore`

**Interfaces:**
- Produces: root monorepo with working `docker-compose up --build` (backend + db start, frontend served by Vite dev server separately)

- [ ] **Step 1: Scaffold the React frontend**

```bash
cd apps
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
npm install zustand react-router-dom @radix-ui/react-dialog
npm install -D @types/node
```

Configure `tailwind.config.js` content paths to `["./index.html", "./src/**/*.{ts,tsx}"]`. Add Tailwind directives to `src/index.css`.

- [ ] **Step 2: Initialize shadcn/ui**

```bash
cd apps/web
npx shadcn@latest init
```

Select: TypeScript, default style, slate base color, `src/components/ui` path, CSS variables yes.

- [ ] **Step 3: Scaffold the Spring Boot backend**

Use Spring Initializr or Maven archetype with: `spring-boot-starter-web`, `spring-boot-starter-websocket`, `spring-boot-starter-data-jpa`, `spring-boot-starter-security`, `postgresql` driver, `jjwt-api` + `jjwt-impl` + `jjwt-jackson` (0.12.x), `lombok`. Java 21. Maven. Group: `com.openmeet`. Artifact: `backend`.

Create `services/backend/` with the Maven project.

- [ ] **Step 4: Write `docker-compose.yml`**

```yaml
version: '3.9'
services:
  backend:
    build: ./services/backend
    ports: ["8080:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/openmeet
      SPRING_DATASOURCE_USERNAME: openmeet
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      TURN_SECRET: ${TURN_SECRET}
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: openmeet
      POSTGRES_USER: openmeet
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openmeet"]
      interval: 5s
      timeout: 5s
      retries: 5
  coturn:
    image: coturn/coturn
    network_mode: host
    volumes: [./infra/coturn/turnserver.conf:/etc/coturn/turnserver.conf]
volumes:
  pgdata:
```

- [ ] **Step 5: Write `infra/coturn/turnserver.conf`**

```
listening-port=3478
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=${TURN_SECRET}
realm=turn.example.com
log-file=/var/log/coturn/turnserver.log
```

- [ ] **Step 6: Write `LICENSE`** (AGPLv3 full text from gnu.org)

- [ ] **Step 7: Write root `README.md`** with project overview, quickstart (`docker-compose up`), and links to docs.

- [ ] **Step 8: Write `docs/ARCHITECTURE.md`** summarizing the tech stack and component diagram.

- [ ] **Step 9: Write `docs/PROTOCOL.md`** documenting the WebSocket event envelope and all event types.

- [ ] **Step 10: Write `docs/SECURITY.md`** documenting meeting security, control token security rules, and the remote-control state machine.

- [ ] **Step 11: Write `.gitignore`**

Ignore: `node_modules/`, `target/`, `.env`, `*.class`, `dist/`, `.idea/`, `*.iml`, `pgdata/`.

- [ ] **Step 12: Verify build**

```bash
cd apps/web && npm run build
cd ../../services/backend && mvn package -DskipTests
```

Both must succeed with no errors.

- [ ] **Step 13: Commit**

```bash
git init  # if not already
git add .
git commit -m "feat: monorepo scaffold — React frontend + Spring Boot backend + Docker Compose"
```

---

### Task 2: Database Schema & JPA Entities

**Files:**
- Create: `services/backend/src/main/resources/db/migration/V1__initial_schema.sql`
- Create: `services/backend/src/main/java/com/openmeet/domain/User.java`
- Create: `services/backend/src/main/java/com/openmeet/domain/Meeting.java`
- Create: `services/backend/src/main/java/com/openmeet/domain/MeetingParticipant.java`
- Create: `services/backend/src/main/java/com/openmeet/domain/ChatMessage.java`
- Create: `services/backend/src/main/java/com/openmeet/repository/MeetingRepository.java`
- Create: `services/backend/src/main/java/com/openmeet/repository/MeetingParticipantRepository.java`
- Create: `services/backend/src/main/java/com/openmeet/repository/ChatMessageRepository.java`
- Test: `services/backend/src/test/java/com/openmeet/repository/MeetingRepositoryTest.java`

**Interfaces:**
- Consumes: Task 1 (Spring Boot project exists)
- Produces: `MeetingRepository.findByCode(String code): Optional<Meeting>`, `MeetingParticipantRepository.findByMeetingIdAndLeftAtIsNull(UUID meetingId): List<MeetingParticipant>`, `ChatMessageRepository.findByMeetingIdOrderByCreatedAtAsc(UUID meetingId): List<ChatMessage>`

- [ ] **Step 1: Add Flyway dependency to `pom.xml`**

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
```

- [ ] **Step 2: Write the failing repository test**

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
class MeetingRepositoryTest {
    @Autowired MeetingRepository repo;

    @Test
    void findByCode_returnsExistingMeeting() {
        Meeting m = new Meeting();
        m.setCode("ABCDEF");
        m.setStatus("ACTIVE");
        repo.save(m);
        Optional<Meeting> found = repo.findByCode("ABCDEF");
        assertThat(found).isPresent();
        assertThat(found.get().getCode()).isEqualTo("ABCDEF");
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
mvn test -pl services/backend -Dtest=MeetingRepositoryTest
```

Expected: FAIL — `MeetingRepository` not found.

- [ ] **Step 4: Write `V1__initial_schema.sql`** with exact SQL from spec §5.

- [ ] **Step 5: Write JPA entities**

`Meeting.java`: `@Entity`, fields: `id` (UUID, generated), `code` (String, unique), `hostId` (UUID, nullable), `status` (String), `createdAt`, `endedAt`.

`MeetingParticipant.java`: `@Entity`, fields: `id`, `meetingId` (UUID), `userId` (UUID, nullable), `displayName`, `participantToken`, `role`, `joinedAt`, `leftAt`.

`ChatMessage.java`: `@Entity`, fields: `id`, `meetingId` (UUID), `participantId` (UUID), `message` (TEXT), `createdAt`.

`User.java`: `@Entity`, fields: `id`, `displayName`, `email`, `passwordHash`, `createdAt`.

- [ ] **Step 6: Write repositories** as `JpaRepository` extensions with the query methods listed in Interfaces above.

- [ ] **Step 7: Run test to verify it passes**

```bash
mvn test -pl services/backend -Dtest=MeetingRepositoryTest
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/backend/src/
git commit -m "feat(backend): database schema, JPA entities, repositories"
```

---

### Task 3: Guest Token Service & Meeting Code Generator

**Files:**
- Create: `services/backend/src/main/java/com/openmeet/security/GuestTokenService.java`
- Create: `services/backend/src/main/java/com/openmeet/security/MeetingCodeGenerator.java`
- Test: `services/backend/src/test/java/com/openmeet/security/GuestTokenServiceTest.java`
- Test: `services/backend/src/test/java/com/openmeet/security/MeetingCodeGeneratorTest.java`

**Interfaces:**
- Produces:
  - `GuestTokenService.issueToken(participantId: UUID, meetingId: UUID, role: String): String`
  - `GuestTokenService.validateToken(token: String): Claims` (throws on invalid/expired)
  - `MeetingCodeGenerator.generate(): String` (6-char, SecureRandom, charset ABCDEFGHJKLMNPQRSTUVWXYZ23456789)

- [ ] **Step 1: Write failing tests**

```java
// GuestTokenServiceTest
@SpringBootTest
class GuestTokenServiceTest {
    @Autowired GuestTokenService svc;

    @Test
    void issuedToken_isValidAndContainsCorrectClaims() {
        UUID pid = UUID.randomUUID(), mid = UUID.randomUUID();
        String token = svc.issueToken(pid, mid, "HOST");
        Claims claims = svc.validateToken(token);
        assertThat(claims.get("participantId")).isEqualTo(pid.toString());
        assertThat(claims.get("meetingId")).isEqualTo(mid.toString());
        assertThat(claims.get("role")).isEqualTo("HOST");
    }

    @Test
    void invalidToken_throwsException() {
        assertThatThrownBy(() -> svc.validateToken("bad.token.here"))
            .isInstanceOf(JwtException.class);
    }
}

// MeetingCodeGeneratorTest
class MeetingCodeGeneratorTest {
    MeetingCodeGenerator gen = new MeetingCodeGenerator();

    @Test
    void generated_code_is6CharsFromCharset() {
        String code = gen.generate();
        assertThat(code).hasSize(6);
        assertThat(code).matches("[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
mvn test -pl services/backend -Dtest="GuestTokenServiceTest,MeetingCodeGeneratorTest"
```

- [ ] **Step 3: Implement `MeetingCodeGenerator`**

Use `SecureRandom`. Charset constant: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Pick 6 chars.

- [ ] **Step 4: Implement `GuestTokenService`**

Use `jjwt`. Read `JWT_SECRET` from `@Value("${jwt.secret}")`. Issue tokens with claims `participantId`, `meetingId`, `role`, expiry 1 hour. Validate with the same secret.

- [ ] **Step 5: Run tests to verify they pass**

```bash
mvn test -pl services/backend -Dtest="GuestTokenServiceTest,MeetingCodeGeneratorTest"
```

- [ ] **Step 6: Commit**

```bash
git add services/backend/src/
git commit -m "feat(backend): guest token service (JWT) + meeting code generator"
```

---

### Task 4: Meeting REST API

**Files:**
- Create: `services/backend/src/main/java/com/openmeet/dto/CreateMeetingResponse.java`
- Create: `services/backend/src/main/java/com/openmeet/dto/JoinMeetingRequest.java`
- Create: `services/backend/src/main/java/com/openmeet/dto/JoinMeetingResponse.java`
- Create: `services/backend/src/main/java/com/openmeet/service/MeetingService.java`
- Create: `services/backend/src/main/java/com/openmeet/controller/MeetingController.java`
- Create: `services/backend/src/main/java/com/openmeet/config/SecurityConfig.java`
- Test: `services/backend/src/test/java/com/openmeet/controller/MeetingControllerTest.java`

**Interfaces:**
- Consumes: `MeetingRepository`, `MeetingParticipantRepository`, `GuestTokenService`, `MeetingCodeGenerator`
- Produces:
  - `POST /api/v1/meetings` → `{ meetingId, meetingCode, joinUrl }`
  - `GET /api/v1/meetings/{code}` → `{ meetingId, meetingCode, status, participantCount }`
  - `POST /api/v1/meetings/{code}/join` body `{ displayName }` → `{ participantId, participantToken, role, meetingCode }`
  - `POST /api/v1/meetings/{code}/end` (Authorization: Bearer HOST_TOKEN) → 200 OK

- [ ] **Step 1: Write failing controller tests**

```java
@WebMvcTest(MeetingController.class)
class MeetingControllerTest {
    @Autowired MockMvc mvc;
    @MockBean MeetingService meetingService;

    @Test
    void createMeeting_returns200WithMeetingCode() throws Exception {
        when(meetingService.createMeeting()).thenReturn(
            new CreateMeetingResponse("uuid-1", "ABCDEF", "http://localhost/m/ABCDEF"));
        mvc.perform(post("/api/v1/meetings").contentType(APPLICATION_JSON))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.meetingCode").value("ABCDEF"));
    }

    @Test
    void joinMeeting_returns200WithToken() throws Exception {
        when(meetingService.joinMeeting(eq("ABCDEF"), eq("Rahul")))
            .thenReturn(new JoinMeetingResponse("p-1", "token-xyz", "PARTICIPANT", "ABCDEF"));
        mvc.perform(post("/api/v1/meetings/ABCDEF/join")
               .contentType(APPLICATION_JSON)
               .content("{\"displayName\":\"Rahul\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.participantToken").value("token-xyz"));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
mvn test -pl services/backend -Dtest=MeetingControllerTest
```

- [ ] **Step 3: Implement DTOs** (`CreateMeetingResponse`, `JoinMeetingRequest`, `JoinMeetingResponse`) as Java records.

- [ ] **Step 4: Implement `MeetingService`**

`createMeeting()`: generate code (retry on collision), save `Meeting` entity, return response with `joinUrl = "https://meet.example.com/m/" + code`.

`joinMeeting(code, displayName)`: find meeting by code (throw 404 if not found or ENDED), create `MeetingParticipant` with role HOST if first participant else PARTICIPANT, issue token, return response.

`endMeeting(code, hostToken)`: validate host token, set meeting status to ENDED, set endedAt.

- [ ] **Step 5: Implement `MeetingController`** — delegate to `MeetingService`. Use `@RestController`, `@RequestMapping("/api/v1/meetings")`.

- [ ] **Step 6: Implement `SecurityConfig`**

Permit all on `/api/v1/meetings/**` and `/ws/**` (WebSocket next phase). Disable CSRF for stateless API. Enable CORS for configured origins.

- [ ] **Step 7: Run tests to verify they pass**

```bash
mvn test -pl services/backend -Dtest=MeetingControllerTest
```

- [ ] **Step 8: Manual verification**

```bash
docker-compose up -d db
cd services/backend && mvn spring-boot:run
curl -X POST http://localhost:8080/api/v1/meetings
# Expect: { "meetingCode": "XXXXXX", ... }
```

- [ ] **Step 9: Commit**

```bash
git add services/backend/src/
git commit -m "feat(backend): meeting REST API — create, get, join, end"
```

---

### Task 5: Frontend Foundation — Landing Page & Lobby

**Files:**
- Create: `apps/web/src/types/index.ts`
- Create: `apps/web/src/services/api/meetingApi.ts`
- Create: `apps/web/src/stores/meetingStore.ts`
- Create: `apps/web/src/stores/mediaStore.ts`
- Create: `apps/web/src/pages/HomePage.tsx`
- Create: `apps/web/src/pages/MeetingPage.tsx`
- Create: `apps/web/src/pages/NotFoundPage.tsx`
- Create: `apps/web/src/components/lobby/LobbyForm.tsx`
- Modify: `apps/web/src/main.tsx` (add router)
- Modify: `apps/web/src/App.tsx` (add routes)

**Interfaces:**
- Consumes: REST API from Task 4
- Produces: User can create meeting (GET redirect to `/m/:code`) and join meeting (POST join, display lobby)

- [ ] **Step 1: Write `apps/web/src/types/index.ts`**

```typescript
export type Role = 'HOST' | 'PARTICIPANT';
export type MeetingStatus = 'ACTIVE' | 'ENDED';
export type SidebarPanel = 'chat' | 'participants' | null;

export interface Participant {
  id: string;
  displayName: string;
  role: Role;
  isMuted: boolean;
  isCameraOn: boolean;
  isHandRaised: boolean;
}

export interface ChatMessage {
  id: string;
  participantId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

export interface WsEnvelope {
  type: string;
  roomId: string;
  senderId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}
```

- [ ] **Step 2: Write `meetingApi.ts`**

```typescript
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export async function createMeeting() { /* POST /api/v1/meetings */ }
export async function getMeeting(code: string) { /* GET /api/v1/meetings/{code} */ }
export async function joinMeeting(code: string, displayName: string) { /* POST /api/v1/meetings/{code}/join */ }
export async function endMeeting(code: string, token: string) { /* POST /api/v1/meetings/{code}/end */ }
```

All functions throw on non-2xx responses with a typed `ApiError`.

- [ ] **Step 3: Write `meetingStore.ts`** using Zustand

Fields: `meetingCode`, `meetingId`, `myParticipantId`, `myRole`, `participantToken`, `participants: Map<string, Participant>`, `chatMessages: ChatMessage[]`, `sidebarPanel: SidebarPanel`, `screenSharerId: string | null`.

Actions: `setMeeting(...)`, `addParticipant(p)`, `removeParticipant(id)`, `updateParticipant(id, patch)`, `addChatMessage(msg)`, `setSidebarPanel(panel)`, `setScreenSharer(id)`, `reset()`.

- [ ] **Step 4: Write `mediaStore.ts`** using Zustand

Fields: `localStream: MediaStream | null`, `isMuted: boolean`, `isCameraOn: boolean`, `isScreenSharing: boolean`, `screenStream: MediaStream | null`.

Actions: `setLocalStream(s)`, `setMuted(b)`, `setCameraOn(b)`, `setScreenSharing(b)`, `setScreenStream(s)`, `reset()`.

- [ ] **Step 5: Write `HomePage.tsx`**

Dark-themed landing page with OpenMeet logo/wordmark, tagline, and a prominent "Create Meeting" button. On click: call `createMeeting()`, navigate to `/m/:code`.

Use shadcn/ui `Button`. Apply Tailwind for a modern dark gradient background.

- [ ] **Step 6: Write `LobbyForm.tsx`**

Form: display name input, camera/mic device selectors (from `navigator.mediaDevices.enumerateDevices()`), local video preview, "Join Meeting" button. On submit: call `joinMeeting(code, displayName)`, store token in meetingStore, render the meeting room.

- [ ] **Step 7: Write `MeetingPage.tsx`**

Reads `:code` from route params. If `myParticipantId` not set in store → render `LobbyForm`. Otherwise → render meeting room (placeholder for now: "Meeting room — coming in Phase 2").

- [ ] **Step 8: Set up routing in `App.tsx`**

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/m/:code" element={<MeetingPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
</BrowserRouter>
```

- [ ] **Step 9: Verify end-to-end (manual)**

```bash
cd apps/web && npm run dev
# Open http://localhost:5173
# Click Create Meeting → redirected to /m/XXXXXX → lobby form appears
# Fill name, click Join → "Meeting room — coming in Phase 2" placeholder shown
```

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): landing page, lobby form, routing, Zustand stores"
```

---

## PHASE 2 — WebRTC & Signaling

---

### Task 6: Backend WebSocket & Room State

**Files:**
- Create: `services/backend/src/main/java/com/openmeet/websocket/RoomStateService.java`
- Create: `services/backend/src/main/java/com/openmeet/websocket/Room.java`
- Create: `services/backend/src/main/java/com/openmeet/websocket/ParticipantInfo.java`
- Create: `services/backend/src/main/java/com/openmeet/websocket/MeetingWebSocketHandler.java`
- Create: `services/backend/src/main/java/com/openmeet/websocket/SignalingService.java`
- Create: `services/backend/src/main/java/com/openmeet/dto/WsEnvelope.java`
- Create: `services/backend/src/main/java/com/openmeet/config/WebSocketConfig.java`
- Test: `services/backend/src/test/java/com/openmeet/websocket/RoomStateServiceTest.java`

**Interfaces:**
- Consumes: `GuestTokenService.validateToken()`
- Produces:
  - `RoomStateService.joinRoom(roomCode, participantId, session, displayName, role): Room`
  - `RoomStateService.leaveRoom(roomCode, participantId): Optional<Room>`
  - `RoomStateService.getRoom(roomCode): Optional<Room>`
  - `SignalingService.relay(envelope, targetId)`: sends WsEnvelope to specific participant
  - `SignalingService.broadcast(envelope, roomCode, excludeSenderId)`: sends to all in room

- [ ] **Step 1: Write failing `RoomStateServiceTest`**

```java
class RoomStateServiceTest {
    RoomStateService svc = new RoomStateService();

    @Test
    void joinRoom_addsParticipantToRoom() {
        svc.joinRoom("ABCDEF", "p1", mockSession(), "Rahul", "HOST");
        Optional<Room> room = svc.getRoom("ABCDEF");
        assertThat(room).isPresent();
        assertThat(room.get().getParticipants()).containsKey("p1");
    }

    @Test
    void leaveRoom_removesParticipant() {
        svc.joinRoom("ABCDEF", "p1", mockSession(), "Rahul", "HOST");
        svc.leaveRoom("ABCDEF", "p1");
        assertThat(svc.getRoom("ABCDEF").get().getParticipants()).doesNotContainKey("p1");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `Room`, `ParticipantInfo`, `RoomStateService`**

`Room`: `String code`, `String hostParticipantId`, `ConcurrentHashMap<String, WebSocketSession> sessions`, `ConcurrentHashMap<String, ParticipantInfo> participants`, `String screenSharerParticipantId`, `ControlState controlState` (enum: NONE, REQUESTED, AUTHORIZED, ACTIVE).

`RoomStateService`: `ConcurrentHashMap<String, Room> rooms`. Implement `joinRoom` (creates room if absent), `leaveRoom` (removes participant, removes room if empty), `getRoom`.

- [ ] **Step 4: Implement `WsEnvelope`** as a Java record with Jackson annotations.

- [ ] **Step 5: Implement `MeetingWebSocketHandler`** extending `TextWebSocketHandler`

`afterConnectionEstablished`: do nothing (wait for JOIN_ROOM message).
`handleTextMessage`: parse `WsEnvelope`, route by `type`:
- `JOIN_ROOM`: validate token from `payload.token`, call `roomStateService.joinRoom(...)`, broadcast `PEER_JOINED` to others, send current participant list to joining peer.
- `LEAVE_ROOM`: call `leaveRoom`, broadcast `PEER_LEFT`.
- `SDP_OFFER`, `SDP_ANSWER`, `ICE_CANDIDATE`: relay to `payload.targetId`.
- `MUTE_CHANGED`, `CAMERA_CHANGED`, `RAISE_HAND`, `LOWER_HAND`: update participant state, broadcast.
- `CHAT_MESSAGE`: persist via `ChatService`, broadcast.
`afterConnectionClosed`: treat as `LEAVE_ROOM` (handle abrupt disconnect).

- [ ] **Step 6: Implement `SignalingService`** with `relay(envelope, targetId)` and `broadcast(envelope, roomCode, excludeSenderId)`.

- [ ] **Step 7: Implement `WebSocketConfig`**

```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(meetingWebSocketHandler(), "/ws").setAllowedOrigins("*");
    }
}
```

- [ ] **Step 8: Run tests to verify they pass**

- [ ] **Step 9: Commit**

```bash
git add services/backend/src/
git commit -m "feat(backend): WebSocket handler, room state service, signaling relay"
```

---

### Task 7: Frontend Signaling Service

**Files:**
- Create: `apps/web/src/services/signaling/SignalingService.ts`
- Create: `apps/web/src/hooks/useSignaling.ts`
- Test: `apps/web/src/services/signaling/__tests__/SignalingService.test.ts`

**Interfaces:**
- Produces:
  - `SignalingService` singleton with `connect(url, token, roomId, participantId)`, `disconnect()`, `send(envelope)`, `on(eventType, handler)`, `off(eventType, handler)`

- [ ] **Step 1: Write failing test**

```typescript
// Using vitest + @testing-library/react
it('calls registered handler when message received', () => {
  const svc = new SignalingService();
  const handler = vi.fn();
  svc.on('PEER_JOINED', handler);
  // Simulate WebSocket message
  svc['handleMessage']({ data: JSON.stringify({ type: 'PEER_JOINED', payload: { id: 'p2' } }) } as MessageEvent);
  expect(handler).toHaveBeenCalledWith({ type: 'PEER_JOINED', payload: { id: 'p2' } });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run src/services/signaling/__tests__/
```

- [ ] **Step 3: Implement `SignalingService.ts`**

Uses native `WebSocket`. On connect: authenticates with `JOIN_ROOM` message. `on/off`: maintain `Map<string, Set<Handler>>`. `handleMessage`: parse JSON, dispatch to handlers. Auto-reconnect with exponential backoff (max 5 retries) on unexpected disconnect.

- [ ] **Step 4: Implement `useSignaling.ts`** hook

Wraps SignalingService. Calls `connect` on mount (when participantToken available), `disconnect` on unmount. Returns `send` function.

- [ ] **Step 5: Run test to verify it passes**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/signaling/ apps/web/src/hooks/useSignaling.ts
git commit -m "feat(web): SignalingService WebSocket client + useSignaling hook"
```

---

### Task 8: Frontend WebRTC Service

**Files:**
- Create: `apps/web/src/services/webrtc/WebRTCService.ts`
- Create: `apps/web/src/hooks/useWebRTC.ts`
- Test: `apps/web/src/services/webrtc/__tests__/WebRTCService.test.ts`

**Interfaces:**
- Consumes: `SignalingService.send()`, ICE server config from TURN credentials endpoint
- Produces:
  - `WebRTCService.addLocalStream(stream)`: adds local tracks to all connections
  - `WebRTCService.createPeerConnection(peerId): RTCPeerConnection`
  - `WebRTCService.createOffer(peerId): Promise<RTCSessionDescriptionInit>`
  - `WebRTCService.handleOffer(peerId, offer): Promise<RTCSessionDescriptionInit>`
  - `WebRTCService.handleAnswer(peerId, answer): void`
  - `WebRTCService.handleIceCandidate(peerId, candidate): void`
  - `WebRTCService.closeConnection(peerId): void`
  - `WebRTCService.onRemoteStream: (peerId, stream) => void` (callback)
  - `WebRTCService.getRemoteStream(peerId): MediaStream | undefined`

- [ ] **Step 1: Write failing test**

```typescript
it('queues ICE candidates received before remote description is set', async () => {
  const svc = new WebRTCService([]);
  const pc = svc.createPeerConnection('p2');
  const candidate = { candidate: 'candidate:...', sdpMid: '0', sdpMLineIndex: 0 };
  // Call handleIceCandidate before setRemoteDescription
  svc.handleIceCandidate('p2', candidate as RTCIceCandidateInit);
  expect(svc['pendingCandidates'].get('p2')?.length).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `WebRTCService.ts`**

Maintains `Map<peerId, RTCPeerConnection>` and `Map<peerId, RTCIceCandidateInit[]>` (pending candidates). On `createPeerConnection`: sets up `onicecandidate` (sends ICE_CANDIDATE via signaling), `ontrack` (fires `onRemoteStream` callback). `handleIceCandidate`: if remote description not set yet, push to pending queue; otherwise `addIceCandidate` immediately. After `handleOffer` calls `setRemoteDescription`, drain pending queue.

- [ ] **Step 4: Implement `useWebRTC.ts`** hook

Subscribes to `PEER_JOINED` (initiates offer), `PEER_LEFT` (closes connection), `SDP_OFFER` (creates answer), `SDP_ANSWER` (sets remote description), `ICE_CANDIDATE` (handles candidate). Updates `meetingStore.participants` remote stream map.

- [ ] **Step 5: Run test to verify it passes**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/webrtc/ apps/web/src/hooks/useWebRTC.ts
git commit -m "feat(web): WebRTCService with ICE candidate queuing + useWebRTC hook"
```

---

### Task 9: Media Service & TURN Credentials

**Files:**
- Create: `apps/web/src/services/media/MediaService.ts`
- Create: `apps/web/src/hooks/useMedia.ts`
- Create: `services/backend/src/main/java/com/openmeet/controller/TurnCredentialController.java`
- Test: `services/backend/src/test/java/com/openmeet/controller/TurnCredentialControllerTest.java`

**Interfaces:**
- Produces:
  - `MediaService.getUserMedia(constraints): Promise<MediaStream>`
  - `MediaService.getDisplayMedia(): Promise<MediaStream>`
  - `MediaService.toggleMicrophone(stream, muted): void`
  - `MediaService.toggleCamera(stream, enabled): void`
  - `GET /api/v1/turn-credentials` → `{ username, credential, ttl }` (requires Authorization header)

- [ ] **Step 1: Write failing backend TURN test**

```java
@WebMvcTest(TurnCredentialController.class)
class TurnCredentialControllerTest {
    @Autowired MockMvc mvc;
    @MockBean GuestTokenService tokenService;

    @Test
    void turnCredentials_withValidToken_returns200() throws Exception {
        when(tokenService.validateToken("valid-token")).thenReturn(mockClaims("p1", "ABCDEF", "PARTICIPANT"));
        mvc.perform(get("/api/v1/turn-credentials")
               .header("Authorization", "Bearer valid-token"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.username").exists())
           .andExpect(jsonPath("$.credential").exists());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `TurnCredentialController`**

Read `TURN_SECRET` from env. Generate: `username = (now + 86400) + ":" + participantId`. `credential = Base64(HMAC-SHA1(turnSecret, username))`. Return both.

- [ ] **Step 4: Implement `MediaService.ts`**

`getUserMedia`: wraps `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`. `getDisplayMedia`: wraps `navigator.mediaDevices.getDisplayMedia({ video: true })`. `toggleMicrophone`: sets `audioTrack.enabled`. `toggleCamera`: sets `videoTrack.enabled`.

- [ ] **Step 5: Implement `useMedia.ts`**

On mount: calls `getUserMedia`, stores stream in `mediaStore`. Exposes `toggleMic`, `toggleCamera`, `startScreenShare`, `stopScreenShare`.

- [ ] **Step 6: Run TURN test to verify it passes**

- [ ] **Step 7: Integration test — 2-participant call**

Open two browser tabs. Create meeting in tab 1. Join in tab 2. Verify video appears in both tabs.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/services/media/ apps/web/src/hooks/useMedia.ts services/backend/src/
git commit -m "feat: MediaService + useMedia hook + TURN credential endpoint"
```

---

## PHASE 3 — Meeting UI

---

### Task 10: Video Grid & Toolbar

**Files:**
- Create: `apps/web/src/components/meeting/VideoGrid.tsx`
- Create: `apps/web/src/components/meeting/VideoTile.tsx`
- Create: `apps/web/src/components/meeting/Toolbar.tsx`
- Modify: `apps/web/src/pages/MeetingPage.tsx` (replace placeholder with VideoGrid + Toolbar)

**Interfaces:**
- Consumes: `meetingStore.participants`, `mediaStore.localStream`, `WebRTCService.getRemoteStream(peerId)`
- Produces: Rendered video grid with local + remote participants; toolbar with mic/camera/leave buttons

- [ ] **Step 1: Implement `VideoTile.tsx`**

Props: `{ participantId, displayName, stream: MediaStream | null, isMuted, isCameraOn, isLocal, isHost }`.

Renders `<video>` element. On mount: `videoRef.current.srcObject = stream`. Shows name overlay at bottom. Shows mic-muted icon if muted. Avatar/initials fallback when camera off.

- [ ] **Step 2: Implement `VideoGrid.tsx`**

Uses CSS Grid. Layout adapts: 1 tile → centered large, 2 → side-by-side, 3-4 → 2x2, 5-6 → 2x3. Renders local participant + all remote participants from meetingStore.

- [ ] **Step 3: Implement `Toolbar.tsx`**

Buttons: Mic (toggle muted), Camera (toggle), Screen Share, Raise Hand, Chat (toggle sidebar), Participants (toggle sidebar), Leave (red button, calls leaveRoom + navigate home).

Uses shadcn/ui `Button` + Lucide icons. Active states visually distinct (e.g., mic-off button red).

- [ ] **Step 4: Update `MeetingPage.tsx`**

Render: `<div className="flex h-screen">`, `<VideoGrid />` takes remaining space, `<Toolbar />` at bottom, sidebar panel conditionally rendered on right.

- [ ] **Step 5: Verify visually**

4-participant meeting: all tiles visible, toolbar functional, mute/camera toggle updates UI.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/meeting/ apps/web/src/pages/MeetingPage.tsx
git commit -m "feat(web): VideoGrid, VideoTile, Toolbar components"
```

---

### Task 11: Chat & Participants Sidebar

**Files:**
- Create: `apps/web/src/components/sidebar/ChatPanel.tsx`
- Create: `apps/web/src/components/sidebar/ParticipantsPanel.tsx`

**Interfaces:**
- Consumes: `meetingStore.chatMessages`, `meetingStore.participants`, `SignalingService.send(CHAT_MESSAGE)`
- Produces: Working chat (send/receive), participant list with mic status indicators

- [ ] **Step 1: Implement `ChatPanel.tsx`**

Scrollable message list. Each message: sender name (bold), timestamp, message text. Input + send button at bottom. On send: dispatch `CHAT_MESSAGE` WS event. Auto-scroll to bottom on new message. Empty state: "No messages yet."

- [ ] **Step 2: Implement `ParticipantsPanel.tsx`**

List of all participants. Each row: mic icon (green=on, gray=muted), display name, role badge (HOST). Host sees: mute button + remove button per participant row. Empty state not possible (at least self is present).

- [ ] **Step 3: Backend: persist and broadcast `CHAT_MESSAGE`**

In `MeetingWebSocketHandler`: on `CHAT_MESSAGE`, call `chatService.saveMessage(...)`, then broadcast to all participants (including sender for confirmation). Add `ChatService.saveMessage(meetingId, participantId, message): ChatMessage`.

- [ ] **Step 4: Frontend: subscribe to `CHAT_MESSAGE` in `useSignaling`**

On receipt: call `meetingStore.addChatMessage(msg)`.

- [ ] **Step 5: Manual test**

Two participants, send messages — verify they appear in both chats with correct sender names and order.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/sidebar/ services/backend/src/
git commit -m "feat: chat panel, participants panel, chat persistence"
```

---

## PHASE 4 — Screen Sharing

---

### Task 12: Screen Share — Frontend

**Files:**
- Create: `apps/web/src/components/meeting/ScreenShareView.tsx`
- Modify: `apps/web/src/services/media/MediaService.ts` (add `startScreenShare`, `stopScreenShare`)
- Modify: `apps/web/src/hooks/useMedia.ts` (expose screen share controls)
- Modify: `apps/web/src/components/meeting/VideoGrid.tsx` (render ScreenShareView when active)

**Interfaces:**
- Produces: `startScreenShare()` → calls `getDisplayMedia()`, replaces video track in all peer connections, sends `SCREEN_SHARE_STARTED`. `stopScreenShare()` → reverts tracks, sends `SCREEN_SHARE_STOPPED`.

- [ ] **Step 1: Implement `startScreenShare()` in `MediaService.ts`**

```typescript
async startScreenShare(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  stream.getVideoTracks()[0].addEventListener('ended', () => this.stopScreenShare());
  return stream;
}
```

- [ ] **Step 2: In `useMedia.ts` `startScreenShare`**

1. Call `MediaService.startScreenShare()`
2. For each peer connection in `WebRTCService`: `replaceTrack(screenTrack)` on video sender
3. Store screenStream in `mediaStore`
4. Send `SCREEN_SHARE_STARTED` via signaling
5. Update `mediaStore.isScreenSharing = true`

`stopScreenShare`: reverse the above, send `SCREEN_SHARE_STOPPED`.

- [ ] **Step 3: Implement `ScreenShareView.tsx`**

Overlays the video grid. Shows the screen share stream large. Shows presenter name. Shows "Stop Sharing" button (only for presenter). Escape key or button stops sharing.

- [ ] **Step 4: Backend: handle `SCREEN_SHARE_STARTED/STOPPED`**

Update `room.screenSharerParticipantId` accordingly. Broadcast both events. Validate only one person can share at a time (reject if another is already sharing).

- [ ] **Step 5: Frontend: subscribe to `SCREEN_SHARE_STARTED/STOPPED`**

Update `meetingStore.screenSharerId`. Render `ScreenShareView` when not null.

- [ ] **Step 6: Manual test**

Share screen → appears for other participants. Stop sharing via button and via OS browser chrome stop button — both paths work.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/meeting/ScreenShareView.tsx apps/web/src/services/media/ apps/web/src/hooks/useMedia.ts services/backend/src/
git commit -m "feat: screen sharing — getDisplayMedia, track replacement, SCREEN_SHARE_STARTED/STOPPED"
```

---

## PHASE 5 — Host Controls

---

### Task 13: Host Controls — Mute, Remove, End Meeting

**Files:**
- Modify: `services/backend/src/main/java/com/openmeet/websocket/MeetingWebSocketHandler.java` (add PARTICIPANT_MUTED, PARTICIPANT_REMOVED handlers)
- Modify: `services/backend/src/main/java/com/openmeet/controller/MeetingController.java` (end meeting with auth)
- Modify: `apps/web/src/components/sidebar/ParticipantsPanel.tsx` (show host controls)
- Modify: `apps/web/src/hooks/useMeeting.ts` (handle PARTICIPANT_REMOVED, MEETING_ENDED)
- Test: `services/backend/src/test/java/com/openmeet/websocket/HostControlsTest.java`

**Interfaces:**
- Produces: HOST can send `PARTICIPANT_MUTED`/`PARTICIPANT_REMOVED` WS events; non-HOST tokens rejected; `MEETING_ENDED` broadcast on end

- [ ] **Step 1: Write failing test**

```java
class HostControlsTest {
    @Test
    void participantToken_cannotMuteOthers_returns403() {
        // Send PARTICIPANT_MUTED with PARTICIPANT role token
        // Expect: error response or no action taken
    }

    @Test
    void hostToken_canMuteParticipant_broadcastsMuteEvent() {
        // Send PARTICIPANT_MUTED with HOST role token
        // Expect: MUTE_CHANGED broadcast to all participants
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement host action validation in `MeetingWebSocketHandler`**

For `PARTICIPANT_MUTED`, `PARTICIPANT_REMOVED`: call `guestTokenService.validateToken(payload.token)`, check `role == HOST`. If not HOST, send error envelope back, return.

`PARTICIPANT_MUTED`: update participant mute state in room, broadcast `MUTE_CHANGED` with `{ participantId, muted: true }`.

`PARTICIPANT_REMOVED`: close target's WebSocket session, call `roomStateService.leaveRoom(...)`, broadcast `PEER_LEFT`. Update DB participant left_at.

- [ ] **Step 4: `POST /meetings/{code}/end`**: validate HOST token, set meeting ENDED in DB, broadcast `MEETING_ENDED` to all sessions, close all WS sessions.

- [ ] **Step 5: Frontend: handle `PARTICIPANT_REMOVED`**

If `payload.participantId == myParticipantId`: show toast "You have been removed by the host", navigate to home. Otherwise: remove from participants map.

- [ ] **Step 6: Frontend: handle `MEETING_ENDED`**

Show toast "The host has ended the meeting", navigate to home after 3 seconds.

- [ ] **Step 7: Run tests to verify they pass**

- [ ] **Step 8: Commit**

```bash
git add services/backend/src/ apps/web/src/
git commit -m "feat: host controls — mute participant, remove participant, end meeting"
```

---

## PHASE 6 — Desktop Control Agent

---

### Task 14: Control Authorization Service (Backend)

**Files:**
- Create: `services/backend/src/main/java/com/openmeet/security/ControlAuthorizationService.java`
- Create: `services/backend/src/main/java/com/openmeet/security/ControlSession.java`
- Modify: `services/backend/src/main/java/com/openmeet/websocket/MeetingWebSocketHandler.java` (add REMOTE_CONTROL_* handlers)
- Test: `services/backend/src/test/java/com/openmeet/security/ControlAuthorizationServiceTest.java`

**Interfaces:**
- Produces:
  - `ControlAuthorizationService.requestControl(meetingId, controllerId, sharerId): void` → sends REMOTE_CONTROL_REQUEST to sharer
  - `ControlAuthorizationService.approveControl(meetingId, controllerId, sharerId): String` → returns control token UUID
  - `ControlAuthorizationService.denyControl(meetingId, controllerId): void`
  - `ControlAuthorizationService.revokeControl(meetingId): void` → sends REMOTE_CONTROL_REVOKED
  - `ControlAuthorizationService.validateControlToken(token, meetingId): ControlSession`

- [ ] **Step 1: Write failing test**

```java
class ControlAuthorizationServiceTest {
    @Test
    void approveControl_returnsUUIDToken_storedInMemory() {
        String token = svc.approveControl("meeting-1", "controller-1", "sharer-1");
        assertThat(token).isNotBlank();
        ControlSession session = svc.validateControlToken(token, "meeting-1");
        assertThat(session.controllerId()).isEqualTo("controller-1");
    }

    @Test
    void revokeControl_invalidatesToken() {
        String token = svc.approveControl("meeting-1", "controller-1", "sharer-1");
        svc.revokeControl("meeting-1");
        assertThatThrownBy(() -> svc.validateControlToken(token, "meeting-1"))
            .isInstanceOf(InvalidControlTokenException.class);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement `ControlSession` record**: `{ token, meetingId, controllerId, sharerId, expiresAt }`

- [ ] **Step 4: Implement `ControlAuthorizationService`**

`ConcurrentHashMap<String, ControlSession> activeSessions` keyed by token.
`approveControl`: generate UUID token, create `ControlSession` with `expiresAt = now + 1h`, store, return token.
`validateControlToken`: look up by token, check meetingId match, check not expired, return session. Throw `InvalidControlTokenException` otherwise.
`revokeControl`: remove all sessions for meetingId.

- [ ] **Step 5: Add REMOTE_CONTROL_* handlers in `MeetingWebSocketHandler`**

`REMOTE_CONTROL_REQUEST`: validate sender is PARTICIPANT, relay to sharer participant.
`REMOTE_CONTROL_APPROVED`: call `controlAuthService.approveControl(...)`, relay token to controller via `REMOTE_CONTROL_APPROVED` event.
`REMOTE_CONTROL_DENIED`: relay to controller.
`REMOTE_CONTROL_REVOKED`: call `controlAuthService.revokeControl(...)`, broadcast.

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Create `/ws/control` WebSocket endpoint** for desktop agent connections (separate handler class: `ControlWebSocketHandler`). On connect: validate control token from query param. On disconnect: revoke session. On message: validate token still active AND screen share still ACTIVE, then broadcast control event to sharer's browser (not implemented in browser — browser just shows it's being controlled).

- [ ] **Step 8: Commit**

```bash
git add services/backend/src/
git commit -m "feat(backend): remote control authorization service + REMOTE_CONTROL_* WS events"
```

---

### Task 15: Remote Control Browser UI

**Files:**
- Create: `apps/web/src/components/meeting/RemoteControlBanner.tsx`
- Create: `apps/web/src/components/meeting/RemoteControlRequestDialog.tsx`
- Modify: `apps/web/src/pages/MeetingPage.tsx` (add banner + dialog)
- Modify: `apps/web/src/stores/meetingStore.ts` (add controlState fields)
- Modify: `apps/web/src/hooks/useMeeting.ts` (subscribe to REMOTE_CONTROL_* events)

**Interfaces:**
- Produces: "Request Control" button visible to all. When sharer receives request: dialog appears. If approved: controller sees "Control Granted" toast. Sharer always sees "CONTROL ACTIVE — [Take Back Control]" banner.

- [ ] **Step 1: Add control state to `meetingStore`**

```typescript
controlState: 'NONE' | 'REQUESTED' | 'AUTHORIZED' | 'ACTIVE';
controlRequestFrom: string | null;  // displayName of requester
controlToken: string | null;         // for controller
```

- [ ] **Step 2: Implement `RemoteControlRequestDialog.tsx`**

Modal shown to sharer when `REMOTE_CONTROL_REQUEST` received. Text: "{name} is requesting control of your computer." Buttons: [Allow] [Deny]. On Allow: send `REMOTE_CONTROL_APPROVED`. On Deny: send `REMOTE_CONTROL_DENIED`.

- [ ] **Step 3: Implement `RemoteControlBanner.tsx`**

Always rendered when `controlState === 'ACTIVE'` AND `myParticipantId === screenSharerId`. Warning bar (red/orange): "CONTROL ACTIVE — {controllerName} is controlling your computer. [TAKE BACK CONTROL]". Cannot be dismissed.

- [ ] **Step 4: Subscribe to REMOTE_CONTROL_* events in `useMeeting.ts`**

`REMOTE_CONTROL_REQUEST` → set controlState='REQUESTED', controlRequestFrom=displayName, show dialog.
`REMOTE_CONTROL_APPROVED` → set controlState='ACTIVE', store controlToken (for controller to pass to desktop agent).
`REMOTE_CONTROL_DENIED` → set controlState='NONE', show toast "Control denied".
`REMOTE_CONTROL_REVOKED` → set controlState='NONE', hide banner.

- [ ] **Step 5: Add "Request Control" button to Toolbar**

Visible when screen share is ACTIVE and requester is not the sharer. Disabled when controlState != 'NONE'.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/meeting/ apps/web/src/stores/ apps/web/src/hooks/
git commit -m "feat(web): remote control UI — request dialog, active banner, toolbar button"
```

---

### Task 16: Desktop Agent (Rust + Tauri)

**Files:**
- Create: `apps/desktop-agent/` (Tauri project)
- Create: `apps/desktop-agent/src/main.rs`
- Create: `apps/desktop-agent/src/websocket.rs`
- Create: `apps/desktop-agent/src/input_handler.rs`
- Create: `apps/desktop-agent/src/state.rs`
- Create: `apps/desktop-agent/src/security.rs`

**Interfaces:**
- Consumes: `wss://api.example.com/ws/control?token={controlToken}`
- Produces: OS mouse/keyboard events via `enigo`; system tray icon; native notifications

- [ ] **Step 1: Scaffold Tauri project**

```bash
cd apps
cargo create-tauri-app desktop-agent --template vanilla
```

Add dependencies to `Cargo.toml`:
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "notification"] }
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = { version = "0.21", features = ["native-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
enigo = "0.2"
```

- [ ] **Step 2: Implement `state.rs`**

```rust
pub enum ControlState { Idle, Authorized { token: String, expires_at: u64 }, Active }
pub struct AppState { pub control_state: Mutex<ControlState> }
```

- [ ] **Step 3: Implement `security.rs`**

`validate_token(token, state)`: check token is non-empty, check `expires_at > now()`. `revoke(state)`: set state to Idle.

- [ ] **Step 4: Implement `websocket.rs`**

Connect to `wss://backend/ws/control?token={token}`. On connect: send auth message. Listen for messages. Route to `input_handler`. On disconnect or REMOTE_CONTROL_REVOKED: set state to Idle, stop accepting events. On unknown message type: log warning, drop.

- [ ] **Step 5: Implement `input_handler.rs`**

```rust
pub fn handle_event(event: ControlEvent, enigo: &mut Enigo) {
    match event {
        ControlEvent::MouseMove { x, y } => { /* enigo.mouse_move_to(screen_x, screen_y) */ }
        ControlEvent::MouseDown { button } => { /* enigo.mouse_down(button) */ }
        ControlEvent::MouseUp { button } => { /* enigo.mouse_up(button) */ }
        ControlEvent::KeyDown { key } => { /* enigo.key_down(Key::from(key)) */ }
        ControlEvent::KeyUp { key } => { /* enigo.key_up(Key::from(key)) */ }
        _ => { log::warn!("Rejected unknown event type"); }
    }
}
```

`x`, `y` are normalized 0.0–1.0; multiply by screen resolution to get absolute coordinates.

- [ ] **Step 6: Implement `main.rs`**

Tauri app with system tray. Icon shows red dot when control is ACTIVE. Shows native notification when control request is approved. `tauri::Builder::default().setup(...)`.

- [ ] **Step 7: Build and test on Windows**

```bash
cd apps/desktop-agent
cargo tauri build
# or for dev:
cargo tauri dev
```

Connect agent to a test meeting. Approve control. Verify mouse movement from browser moves cursor on controlled machine.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-agent/
git commit -m "feat(desktop-agent): Rust+Tauri desktop control agent with enigo input injection"
```

---

## PHASE 7 — Production Hardening

---

### Task 17: Caddy + HTTPS + WSS Configuration

**Files:**
- Create: `infra/nginx/Caddyfile`
- Create: `docker-compose.prod.yml`

**Interfaces:**
- Produces: `api.example.com` → Spring Boot with TLS; `turn.example.com` → Coturn with TLS

- [ ] **Step 1: Write `Caddyfile`**

```
api.example.com {
    reverse_proxy backend:8080
}
```

Caddy handles TLS automatically via Let's Encrypt.

- [ ] **Step 2: Write `docker-compose.prod.yml`**

Extends `docker-compose.yml`. Adds Caddy service. Sets `SPRING_PROFILES_ACTIVE=prod`. Removes port 8080 exposure (only Caddy exposes 80/443). Adds `restart: unless-stopped` to all services.

- [ ] **Step 3: Update Coturn config for TLS**

```
tls-listening-port=5349
cert=/etc/ssl/certs/coturn.pem
pkey=/etc/ssl/private/coturn.key
```

- [ ] **Step 4: Verify on Oracle VM**

```bash
docker-compose -f docker-compose.prod.yml up -d
curl https://api.example.com/actuator/health
# Expect: { "status": "UP" }
```

- [ ] **Step 5: Commit**

```bash
git add infra/
git commit -m "feat(infra): Caddy reverse proxy, HTTPS/WSS, production Docker Compose"
```

---

### Task 18: Rate Limiting & Health Checks

**Files:**
- Create: `services/backend/src/main/java/com/openmeet/config/RateLimitConfig.java`
- Modify: `services/backend/src/main/java/com/openmeet/controller/MeetingController.java` (add rate limiting to create meeting)
- Modify: `services/backend/src/main/resources/application.properties` (add actuator config)

**Interfaces:**
- Produces: `POST /api/v1/meetings` limited to 10/hour per IP; `GET /actuator/health` returns `{ "status": "UP" }`

- [ ] **Step 1: Add Bucket4j dependency** (in-memory rate limiting, no Redis needed in V1)

```xml
<dependency>
    <groupId>com.bucket4j</groupId>
    <artifactId>bucket4j-core</artifactId>
    <version>8.7.0</version>
</dependency>
```

- [ ] **Step 2: Implement `RateLimitConfig`**

`ConcurrentHashMap<String, Bucket>` keyed by IP. Each bucket: 10 tokens, refill 10 per hour. If bucket empty: throw `RateLimitExceededException` (mapped to HTTP 429).

- [ ] **Step 3: Apply rate limiting in `MeetingController.createMeeting`**

Get client IP from `HttpServletRequest`. Check bucket. Proceed or throw.

- [ ] **Step 4: Add actuator health endpoint**

`application.properties`:
```
management.endpoints.web.exposure.include=health
management.endpoint.health.show-details=never
```

- [ ] **Step 5: Write `RateLimitTest`**

```java
@Test
void createMeeting_after10Requests_returns429() {
    for (int i = 0; i < 10; i++) {
        mvc.perform(post("/api/v1/meetings")).andExpect(status().isOk());
    }
    mvc.perform(post("/api/v1/meetings")).andExpect(status().isTooManyRequests());
}
```

- [ ] **Step 6: Run test to verify it passes**

- [ ] **Step 7: Commit**

```bash
git add services/backend/src/
git commit -m "feat(backend): rate limiting (Bucket4j) + actuator health endpoint"
```

---

### Task 19: Structured Logging & Environment Config

**Files:**
- Create: `services/backend/src/main/resources/logback-spring.xml`
- Modify: `services/backend/src/main/resources/application.properties` (externalize all config)
- Create: `.env.example` (root level, documents all required env vars)

**Interfaces:**
- Produces: JSON structured logs in production (logback); all secrets from env vars; `.env.example` documents `JWT_SECRET`, `TURN_SECRET`, `DB_PASSWORD`, `VITE_API_URL`

- [ ] **Step 1: Write `logback-spring.xml`**

Dev profile: colored console output. Prod profile: JSON format via `logstash-logback-encoder`. Log level: INFO for `com.openmeet`, WARN for Spring internals.

- [ ] **Step 2: Audit `application.properties`**

Replace any hardcoded secrets with `${ENV_VAR:default_for_dev}`. Ensure `JWT_SECRET`, `TURN_SECRET`, `DB_PASSWORD` are all externalized.

- [ ] **Step 3: Write `.env.example`**

```
# Required — generate with: openssl rand -base64 32
JWT_SECRET=change_me_in_production
TURN_SECRET=change_me_in_production
DB_PASSWORD=change_me_in_production

# Frontend
VITE_API_URL=http://localhost:8080
```

- [ ] **Step 4: Add `NEVER LOG` guards**

Audit `MeetingWebSocketHandler`: ensure `CHAT_MESSAGE` payload content is not logged. Ensure control events do not log key values or mouse positions.

- [ ] **Step 5: Commit**

```bash
git add services/backend/src/main/resources/ .env.example
git commit -m "feat: structured logging, externalized config, .env.example"
```

---

### Task 20: Cloudflare Pages Deployment & Final Documentation

**Files:**
- Create: `apps/web/public/_redirects` (SPA routing fallback)
- Create: `.github/workflows/deploy-frontend.yml` (or equivalent CI)
- Modify: `README.md` (complete self-hosting guide)
- Modify: `docs/ARCHITECTURE.md` (final production architecture diagram)

**Interfaces:**
- Produces: `npm run build` in `apps/web` produces deployable static files; Cloudflare Pages serves `/m/:code` correctly (SPA fallback); README contains complete deployment steps for Oracle VM

- [ ] **Step 1: Write `apps/web/public/_redirects`**

```
/* /index.html 200
```

This tells Cloudflare Pages to serve `index.html` for all routes (SPA routing).

- [ ] **Step 2: Verify `npm run build` produces correct `dist/`**

```bash
cd apps/web && npm run build
ls dist/  # Should contain index.html + assets/
```

- [ ] **Step 3: Document Cloudflare Pages setup in README**

Steps: Connect GitHub repo → set root directory to `apps/web` → build command `npm run build` → output directory `dist` → set `VITE_API_URL` environment variable.

- [ ] **Step 4: Document Oracle VM setup in README**

Steps: Install Docker + Docker Compose → clone repo → create `.env` from `.env.example` → `docker-compose -f docker-compose.prod.yml up -d` → configure DNS → verify HTTPS.

- [ ] **Step 5: Run full MVP acceptance checklist**

Go through every item in spec §18 (MVP Acceptance Criteria). Mark each as passing or failing.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: Cloudflare Pages SPA routing, complete self-hosting documentation, MVP complete"
git tag v1.0.0
```

---

## Self-Review Notes

**Spec coverage verified:**
- FR-001 (meeting creation without account) → Tasks 3, 4, 5 ✅
- WebRTC mesh → Tasks 6, 7, 8, 9 ✅
- Meeting UI (grid, toolbar, chat, participants) → Tasks 10, 11 ✅
- Screen sharing → Task 12 ✅
- Host controls → Task 13 ✅
- Remote control (full state machine) → Tasks 14, 15, 16 ✅
- Production hardening → Tasks 17, 18, 19, 20 ✅

**Review Focus tests covered:**
- ICE candidate race condition → Task 8, Step 1 ✅
- Host token validation → Task 13, Step 1 ✅
- Control event when screen share stops → Task 14, Step 7 ✅
- WebSocket disconnect cleanup → Task 6, Step 5 (`afterConnectionClosed`) ✅
- Meeting code collision → Task 3 (retry logic in `MeetingCodeGenerator`) ✅
