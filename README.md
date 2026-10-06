# OpenMeet 🎥

> Lightweight, open-source, self-hostable video meeting platform built with a **Modular Monolith** architecture. Direct peer-to-peer WebRTC mesh, instant room joining, screen sharing, live chat, host controls, and remote desktop control.

---

## 🌟 Key Features

- **P2P WebRTC Mesh**: Zero intermediate media server (SFU/MCU). Direct peer-to-peer audio and video encrypted streams.
- **Signaling-Only Backend**: Spring Boot handles room handshakes, JWT tokens, and chat history. Never handles heavy media traffic.
- **Modular Monolith**: Separated cleanly into `frontend` (React + JavaScript + Tailwind CSS) and `backend` (Spring Boot + Java + MySQL).
- **Instant Meeting Access**: Create a meeting with a 6-character room code or join instantly via shareable URL—no registration required.
- **Full Host Controls**: Mute participants, kick participants, end meeting for all.
- **Screen Sharing**: One-click screen sharing with automatic video track switching.
- **In-Meeting Chat**: Real-time persistent chat history synchronized with MySQL.
- **Remote Desktop Control Ready**: P2P control signaling protocol for desktop automation sessions.

---

## 🏗️ Architecture Overview

```
openmeet/
├── backend/                       # Spring Boot Modular Monolith (Java + MySQL)
│   ├── src/main/java/com/openmeet/
│   │   ├── OpenMeetApplication.java
│   │   ├── config/                # Security, WebSocket (/ws), CORS
│   │   └── modules/
│   │       ├── meeting/           # Room creation, 6-char code generator, lifecycle
│   │       ├── signaling/         # WebRTC mesh signaling, RoomManager, WS handler
│   │       ├── auth/              # JJWT participant token issuance & validation
│   │       └── chat/              # Chat message persistence & history
│   └── src/main/resources/
│       └── application.yml        # MySQL datasource & STUN server configs
├── frontend/                      # React 19 + JavaScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── modules/
│   │   │   ├── landing/           # Instant Meeting creation & Join with Code
│   │   │   ├── meeting/           # Video Arena, Gallery/Stage views, Controls bar
│   │   │   ├── webrtc/            # WebRtcManager (ICE queuing, SDP routing, Zustand)
│   │   │   ├── chat/              # In-meeting chat drawer
│   │   │   └── participants/      # Participants management drawer & host actions
│   │   └── App.jsx
└── docs/                          # Technical specs, architecture & security
```

---

## 🚀 Quickstart (Running Locally without Docker)

### Prerequisites
- **Node.js**: v20+ (v24 tested)
- **Java**: JDK 21+ (JDK 26 tested)
- **Maven**: 3.9+
- **MySQL**: 8.0+ running on port 3306

---

### Step 1: Start Backend (Spring Boot)

1. Ensure MySQL is running on `localhost:3306` with database `openmeet` created.
2. In the `backend` directory, run:
```bash
cd backend
mvn spring-boot:run
```
The backend starts on `http://localhost:8080`.

---

### Step 2: Start Frontend (Vite)

In the `frontend` directory, run:
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

---

### Step 3: Test a P2P Video Call

1. Open `http://localhost:5173` in Browser Window 1. Enter your name and click **Start Meeting Now**.
2. Copy the 6-character room code or the invite link.
3. Open `http://localhost:5173` in Browser Window 2 (or an incognito window/different browser). Enter the room code and join.
4. Both participants connect directly via WebRTC mesh! You can toggle audio/video, share screen, send chat messages, and manage participants.

---

## 🛡️ Security & Privacy

- **Signaling-Only Server**: Video and audio streams never pass through or get saved on the server.
- **Signed Tokens**: Cryptographically signed participant JWTs with 1-hour expiration enforce authorization and host privileges.
- **Host Permission Validation**: Destructive WS actions (`MUTE_PARTICIPANT`, `KICK_PARTICIPANT`, `END_MEETING`) verify the sender's role before processing.

---

## 📜 License

OpenMeet is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).
