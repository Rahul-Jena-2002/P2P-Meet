# 🛡️ p2pmeet

<p align="center">
  <img src="p2p-app/public/p2pmeet-logo.svg" alt="p2pmeet Logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Decentralized, Privacy-First Video Conferencing & Direct P2P File Sharing</strong><br>
  <em>Peer-relayed WebRTC media • No cloud file storage • Encrypted transport</em>
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
  - Small meetings send media directly between participants. In larger meetings, up to two eligible desktop peers are elected to forward media to assigned participants; no dedicated media server is used.
  - WebRTC encrypts each network connection. A peer forwarding media receives decoded tracks, so this relay mode is **not end-to-end encrypted against the elected relay peers**.
  - MQTT signaling coordinates room discovery and connection setup. Selected-file bytes travel over direct WebRTC data channels and are never uploaded to Pages or MQTT.
- **📁 Universal Direct P2P File Sharing & Requests**:
  - Share files of **ANY format** directly inside the meeting chat.
  - Interactive file cards with file size, direct P2P badge, and one-click instant download.
  - "Request File" feature allowing participants to request documents or assets from specific peers.
- **✨ Camera Background Blur & Screen Filters**:
  - Virtual background effects including **Soft Blur**, **Deep Blur**, **Studio Glow**, **Warm Sun**, **Vivid Pop**, and **Cinema Noir**.
  - Flexible video grid with Speaker View & Gallery View.
- **🎉 Interactive Emoji Reactions & Audio**:
  - Categorized reaction bar (Smileys, Animals & Nature, Gestures, Celebrations & Vibes).
  - Built-in audio effects synthesized in real-time via Web Audio API.
- **🎬 Watch Together (Co-Streaming)**:
  - Synchronized video player inside the call with shared play, pause, seek, and presets.
- **🖱️ Remote Interactive Screen Control**:
  - Request and grant screen pointer assistance with live animated ripples.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 2. Install & Run
```bash
# Clone the repository
git clone https://github.com/Rahul-Jena-2002/P2P-Meet.git
cd P2P-Meet/p2p-app

# Install dependencies
npm install

# Start development server
npm run dev

# Start local WebSocket signaling server (optional for local LAN testing)
node signaling-server.mjs
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⛅ Hosting on Cloudflare Pages

`p2pmeet` is pre-configured for static export to Cloudflare Pages:

Meeting signaling prefers a Cloudflare Durable Object WebSocket. Deploy the
`p2pmeet-signaling` Worker first, then deploy Pages so the configured
`MEETING_ROOMS` binding can resolve. This Worker coordinates room presence and
WebRTC offers/candidates only; media and file bytes stay on WebRTC peer
connections. If the Pages Function or Durable Object is unavailable, the
browser falls back to the existing public MQTT broker. The Durable Object uses
the Free Workers plan's SQLite-backed namespace and WebSocket hibernation; free
usage has daily limits (100,000 requests and 13,000 GB-s per day, shared with
other Durable Objects/Workers usage on the account). Incoming WebSocket
messages are counted at 20 messages per request. See
[Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/);
the MQTT fallback remains enabled.

```bash
# From the repository root; requires a Cloudflare account logged into Wrangler.
npm run deploy:signaling
npm run build
npm run deploy
```

The Pages project must be deployed from this repository root so Wrangler uses
the root `wrangler.toml` and `functions/` directory. If the Pages project is
configured with `p2p-app` as its root directory, change it to the repository
root before deploying the Durable Object binding.

### Method 1: Connect GitHub Repository to Cloudflare Pages (Recommended)
1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Compute (Workers & Pages)** → **Create** → **Pages** → **Connect to Git**.
2. Select repository: `Rahul-Jena-2002/P2P-Meet`.
3. In Build settings:
   - **Framework preset**: `Next.js (Static Export)`
   - **Build command**: `cd p2p-app && npm install && npm run build`
   - **Build output directory**: `p2p-app/out`
   - *(Or if Root Directory is set to `p2p-app`)*:
     - **Build command**: `npm run build`
     - **Build output directory**: `out`
4. Click **Save and Deploy**!

### Method 2: Deploy via Wrangler CLI
```bash
# From repository root
npm run build
npm run deploy:signaling
npm run deploy
```

---

## 💖 Support the Developer

If you find `p2pmeet` useful or want to support continued development of open-source privacy-first communication tools, please consider sponsoring:

👉 **[Sponsor Rahul Jena on GitHub](https://github.com/sponsors/Rahul-Jena-2002)**

---

## 📜 License

This project is licensed under the **AGPL-3.0 License** - see the LICENSE file for details.
