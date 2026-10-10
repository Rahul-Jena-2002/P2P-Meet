# Decentralized P2P Zoom Architecture & Zoom UI Design

**Date:** 2026-10-10  
**License:** AGPL-3.0  
**Status:** Approved for Implementation  

---

## 1. Executive Summary

This specification defines the complete architecture and UI implementation for a **serverless, decentralized, privacy-first video conferencing application** modeled after the industrial reliability of **Zoom and Google Meet**, with the zero-infrastructure, end-to-end encrypted ethos of **BitChat**.

### Core Pillars
1. **Serverless & Decentralized:** 100% peer-to-peer with zero central media or database servers.
2. **STUN-Only NAT Traversal:** Utilizes public Cloudflare and Google STUN servers with zero TURN dependencies.
3. **Zero-Trust E2EE (SFrame / Insertable Streams):** Video and audio frames are encrypted with AES-256-GCM before transport. Relaying peers only handle opaque ciphertext.
4. **Zoom BCDR Disaster Recovery:** Dynamic Supernode SFU with hot standby re-election and off-grid LAN/mDNS fallback.
5. **Zoom Enterprise UI:** Full Zoom UI layout including dark canvas, Zoom dock, audio meter, virtual background popovers, active speaker highlighting, and high-fidelity screen share (1080p to 4K).

---

## 2. Network Topology & STUN Configuration

### 2.1 Pure STUN ICE Servers
The system connects peers across the internet without any private TURN server or backend credential generator.
```javascript
export const P2P_RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 2
};
```

### 2.2 Multi-Transport Hybrid Signaling
Peer discovery and SDP/ICE signaling operate across 3 fallback tiers:
1. **Tier 1 (Internet Mesh):** Public decentralized relays (Nostr ephemeral encrypted events signed via Ed25519 with NIP-44 encryption + WebTorrent trackers).
2. **Tier 2 (Local Offline Mesh):** Local LAN mDNS / broadcast discovery for off-grid operation without internet access.
3. **Tier 3 (Zero-Infra Direct Rendezvous):** URL hash fragment / QR code containing compressed SDP offer/answer for air-gapped or 1-on-1 handshakes.

---

## 3. Media Pipeline & High-Fidelity Streaming

### 3.1 Screen Share Pipeline (1080p to 4K Native Resolution)
Screen sharing delivers full uncompressed monitor clarity:
```javascript
const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: {
    width: { ideal: 1920, max: 3840 },
    height: { ideal: 1080, max: 2160 },
    frameRate: { ideal: 30, max: 60 }
  },
  audio: {
    channelCount: 2,
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false
  }
});

// Enforce text sharpness over framerate degradation
const videoTrack = screenStream.getVideoTracks()[0];
if ('contentHint' in videoTrack) {
  videoTrack.contentHint = 'detail';
}
```

### 3.2 Dynamic Simulcast & Viewport Optimization
* **Camera Video:** 3 spatial layers (720p 30fps high, 360p 24fps medium, 180p 15fps low).
* **Active Speaker Allocation:** High layer is dynamically routed to the active speaker; gallery thumbnails receive low/medium layers to protect peer upload pipes.
* **Viewport Subscription:** Hidden tiles and minimized tabs pause downstream video subscriptions via `SUBSCRIBE(sourceId, layer: 0)` to minimize client CPU and battery consumption.

### 3.3 Dual-Track Stereo Audio
* Microphone track is optimized for voice with acoustic echo cancellation (AEC) and noise suppression.
* Screen audio is sent as a discrete second audio track with stereo SDP injection (`stereo=1; sprop-stereo=1; maxaveragebitrate=510000`).

---

## 4. Zoom BCDR Disaster Recovery (Supernode SFU)

### 4.1 Topology Transitions
* **Small Rooms ($N \le 4$):** Full P2P Mesh for direct low-latency streams.
* **Larger Rooms ($N > 4$):** The peer with the highest `relayScore` (based on upstream bandwidth, low RTT, CPU load, and AC power status) is elected as **Supernode**.

### 4.2 Zero-Drop Re-Election
* Peers maintain a lightweight 1-second SWIM gossip heartbeat.
* The 2nd highest-scoring node is pre-assigned as **Hot Standby**.
* If the primary Supernode's connection degrades (packet loss > 15% or heartbeat timeout > 2.5s):
  1. The Hot Standby immediately promotes to primary.
  2. Downstream peers reparent subscriptions to the new Supernode.
  3. Failover completes in $< 400$ms with zero audio interruption.

---

## 5. Zoom UI Specification & Design System

### 5.1 Color Tokens & Theme
* **Canvas Background:** Deep Dark Obsidian (`--bg-primary: #0D0B14`, `--bg-surface: #161324`).
* **Accents:** Frosted Lavender (`#C4B5FD`, glow `#A78BFA`) for structural borders and secondary badges.
* **Active Speaker:** Electric Orange (`#FF6B35`, glow `0 0 8px rgba(255, 107, 53, 0.25)`).
* **Leave / Danger:** Crimson Red (`#EF4444`).
* **Share Screen:** High-contrast Vibrant Accent (`#22C55E` / `#FF6B35`).

### 5.2 Interface Structure
1. **Top Bar:**
   - Security Shield with E2EE status and STUN diagnostic stats modal.
   - Meeting code and live session timer (`00:14:22`).
   - Gallery View (`▦`) vs Speaker View (`👤`) toggle + Fullscreen button.
2. **Video Grid & Video Tiles:**
   - Auto-computed grid layouts ($1\times1$, $2\times1$, $2\times2$, $3\times3$).
   - Active speaker highlighting with 1.5px Electric Orange border.
   - Top-right 3-bar signal strength meter (Green $\le 80$ms, Yellow $\le 180$ms, Red $> 180$ms).
   - Bottom-left name tag with dynamic audio visualizer waves when speaking.
   - Hover quick actions: Pin Video, Hide Self-View.
3. **Zoom Bottom Control Dock:**
   - **Mute / Unmute:** Mic icon with dynamic audio level meter + up-arrow for audio device selection.
   - **Start / Stop Video:** Camera icon + up-arrow for camera selection and Virtual Background popover.
   - **Security:** Host quick toggles (Lock Room, Allow Share Screen, Allow Chat).
   - **Participants:** Counter badge + drawer toggle.
   - **Chat:** Unread badge + drawer toggle.
   - **Share Screen:** High-contrast screen share button with audio toggle.
   - **Reactions:** Zoom emoji reaction bar (👍 👏 ❤️ 😂 😮 🎉) + Raise Hand.
   - **Leave Meeting:** Red button with exit confirmation.
4. **Side Drawers:**
   - **Participants Drawer:** Participant list with host badges, mic/camera indicators, Mute All, and Invite Link.
   - **Chat Drawer:** E2EE text messaging and direct P2P file dropzone with real-time transfer progress.

---

## 6. Implementation & Verification Plan

1. **Verify RTC Configuration:** Confirm STUN-only configuration across `PeerConnectionManager.js` and remove any dead TURN requirements.
2. **Enforce Screen Share Resolution:** Update screen capture constraints in `MediaManager.js` to support 1080p minimum and up to 4K native display resolution with `contentHint = 'detail'`.
3. **Refine Zoom UI & Components:** Ensure `P2PMeetingRoom.jsx`, `P2PControls.jsx`, `P2PHeader.jsx`, and `P2PGrid.jsx` provide the complete Zoom dock and toolbar aesthetics with the active theme colors.
4. **Automated Testing:** Run full suite of unit and integration tests (`npm test`) to guarantee zero regressions.
