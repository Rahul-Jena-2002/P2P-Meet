# 🛡️ p2pmeet - Decentralized Privacy-First Video Meetings

<p align="center">
  <img src="public/p2pmeet-logo.svg" alt="p2pmeet Logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Decentralized, Privacy-First Video Conferencing & Direct P2P File Sharing</strong><br>
  <em>Direct peer connections when available • No file storage • Encrypted WebRTC transport</em>
</p>

<p align="center">
  <a href="https://github.com/sponsors/Rahul-Jena-2002"><img src="https://img.shields.io/badge/Sponsor%20Author-%E2%9D%A4-ea4aaa?style=for-the-badge&logo=githubsponsors" alt="Sponsor" /></a>
  <img src="https://img.shields.io/badge/License-AGPL--3.0-orange?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/WebRTC-P2P%20Mesh-blue?style=for-the-badge" alt="WebRTC Mesh" />
  <img src="https://img.shields.io/badge/Cloudflare-Pages%20Ready-F38020?style=for-the-badge&logo=cloudflare" alt="Cloudflare" />
</p>

---

## 🌟 Key Features

- **🔒 Peer-to-Peer WebRTC**:
  - Meeting signaling prefers a Cloudflare Durable Object WebSocket and falls back to the existing public MQTT broker if unavailable. It carries presence and WebRTC negotiation only; media and file bytes remain on peer-to-peer WebRTC connections.
  - Small meetings send audio/video directly between participants. Larger meetings can elect up to two capable desktop peers to forward media to assigned participants.
  - WebRTC uses public STUN servers only. Direct and peer-relayed connections still require ICE connectivity between each sender and its peer/relay; no TURN service or cloud file storage is used. Some mobile-carrier and restrictive NAT combinations will not connect.
  - WebRTC encrypts each transport connection, but an elected browser relay receives decoded media tracks. Relay mode is not end-to-end encrypted against those relay participants.
- **📁 Direct P2P File Sharing & Requests**:
  - Share files up to 500 MB directly inside the meeting chat.
  - Interactive file cards with file size, direct P2P badge, and one-click instant download.
  - "Request File" feature allowing participants to request documents or assets from specific peers.
- **✨ Camera Background Blur & Screen Filters**:
  - Virtual background effects including **Soft Blur**, **Deep Blur**, **Studio Glow**, **Warm Sun**, **Vivid Pop**, and **Cinema Noir**.
  - Flexible video grid with Speaker View & Gallery View that never overlaps with chat or participant drawers.
- **🎉 Interactive Emoji Reactions & Audio**:
  - Categorized reaction bar (Smileys, Animals & Nature, Gestures, Celebrations & Vibes).
  - Built-in audio effects synthesized in real-time via Web Audio API.
- **🎬 Watch Together (Co-Streaming)**:
  - Synchronized video player inside the call with shared play, pause, seek, and presets.
- **🖱️ Remote Interactive Screen Control**:
  - Request and grant screen pointer assistance with live animated ripples.

---

## Cloudflare Pages networking setup

Deploy the `p2pmeet-signaling` Worker from `signaling-worker/wrangler.toml`
before deploying the Pages site. The root `wrangler.toml` binds the Pages
Function at `/api/signaling` to that Worker. Durable Objects are available on
Cloudflare Workers Free with daily request and compute limits. The Worker uses
WebSocket hibernation so idle room sockets can hibernate; if the free quota is
exceeded or signaling is unavailable, clients can fall back to MQTT. Current
free allotments include 100,000 Durable Object requests and 13,000 GB-s per
day; WebSocket messages count at 20 incoming messages per request. See
[Cloudflare's pricing and quota details](https://developers.cloudflare.com/durable-objects/platform/pricing/).

The Pages build is a static export (`out/`). Cloudflare serves the application; Durable Objects or the MQTT fallback coordinate peer discovery and WebRTC handshakes. Audio/video travel over WebRTC peer connections, sometimes through elected participant browsers. File bytes travel over direct WebRTC data channels and are never posted to Pages or signaling. This deployment intentionally uses public STUN only, with no TURN credentials, paid media relay, or file upload path. Some restrictive NAT/firewall combinations will prevent calls or transfers from connecting.

Received files are assembled in the recipient's browser and downloaded from there. Both participants must stay in the meeting until transfer completes. Use the browser's file picker; a web page cannot access a local path supplied as text. Files up to 500 MB are sent in 16 KiB binary chunks with data-channel backpressure instead of being base64 encoded in memory or sent through MQTT/signaling.

## Windows remote desktop control

Remote mouse and keyboard input requires the optional Windows Native Messaging helper and Chromium browser extension in [`native/README.md`](native/README.md). The sharer must approve the participant in the meeting and separately approve Windows' helper prompt. Inputs are sent over that participant's direct WebRTC data channel. The first version controls the primary display only and requires sharing the full display; window-only and secondary-monitor control are not supported. The website-only cursor preview is not a substitute for installing the native helper.

Files up to 500 MB are supported in the meeting chat. The app sends the selected `File` in 16 KiB binary chunks with data-channel backpressure instead of encoding the whole file in memory or sending it through MQTT/signaling.

## 💖 Support the Developer

👉 **[Sponsor Rahul Jena on GitHub](https://github.com/sponsors/Rahul-Jena-2002)**
