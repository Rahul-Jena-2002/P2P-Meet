# Decentralized P2P Zoom Architecture & Zoom UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a serverless, STUN-only P2P video conferencing platform featuring native 1080p+ screen sharing, Zoom-style UI controls, and BCDR-inspired self-healing topologies.

**Architecture:** Client-side WebRTC mesh with dynamic Supernode SFU routing, zero-trust SFrame frame encryption, and pure STUN NAT traversal. Complete Zoom UI layout implemented in React with an Obsidian dark canvas, Frosted Lavender structural borders, and Electric Orange active speaker accents.

**Tech Stack:** Next.js / React 19, WebRTC (Insertable Streams / SFrame, `contentHint`), Web Audio API, Tailwind CSS v4, Lucide Icons.

**Spec:** [docs/superpowers/specs/2026-10-10-p2p-zoom-architecture-and-ui-design.md](file:///g:/projectssss/Zoom%20Replica/docs/superpowers/specs/2026-10-10-p2p-zoom-architecture-and-ui-design.md)

## Global Constraints

- 100% serverless: Zero backend media servers or TURN credentials required.
- STUN configuration pinned to `stun:stun.cloudflare.com:3478` and `stun:stun.l.google.com:19302`.
- Screen share capture floor of 1080p (`ideal: 1920x1080`), ceiling up to 4K (`max: 3840x2160`), with `contentHint = 'detail'`.
- Zoom UI styling pinned to design tokens: Deep Obsidian (`#0D0B14`), Frosted Lavender (`#C4B5FD`), Electric Orange (`#FF6B35`).

## Review Focus

1. **STUN-Only Candidate Harvesting:** Ensure ICE candidate exchange successfully resolves reflexive candidates with Cloudflare and Google STUN without blocking on TURN.
2. **Screen Share Sharpness Preservation:** Verify `contentHint = 'detail'` is applied to the screen track to prevent WebRTC resolution downsampling during packet loss.
3. **Active Speaker Audio Metering:** Confirm Web Audio API analyser correctly feeds live amplitude to the microphone icon level meter and active speaker halo.
4. **Re-Election Under Supernode Disconnect:** Confirm SWIM gossip heartbeat detects peer drop and triggers hot standby promotion in $< 400$ms.
5. **Responsive View Modes:** Ensure switching between Gallery View and Speaker View preserves video stream bindings without re-negotiating WebRTC peer connections.

---

### Task 1: STUN-Only Network Configuration in `PeerConnectionManager.js`

**Files:**
- Modify: `p2p-app/src/core/rtc/PeerConnectionManager.js:8-23`
- Modify: `p2p-app/test/peerConnectionManager.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_RTC_CONFIG` with pure Cloudflare (`stun.cloudflare.com:3478`) and Google (`stun.l.google.com:19302`) STUN servers.

- [ ] **Step 1: Write the failing test**

In `p2p-app/test/peerConnectionManager.test.mjs`, add:
```javascript
test('DEFAULT_RTC_CONFIG contains Cloudflare and Google STUN servers with zero TURN requirement', () => {
  const stunUrls = DEFAULT_RTC_CONFIG.iceServers.map(s => s.urls).flat();
  assert.ok(stunUrls.includes('stun:stun.cloudflare.com:3478'));
  assert.ok(stunUrls.includes('stun:stun.l.google.com:19302'));
  const hasTurn = DEFAULT_RTC_CONFIG.iceServers.some(s => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some(u => u.startsWith('turn:'));
  });
  assert.strictEqual(hasTurn, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "node --test test/peerConnectionManager.test.mjs"`
Expected: FAIL (missing `stun.cloudflare.com:3478`).

- [ ] **Step 3: Update `DEFAULT_RTC_CONFIG` in `PeerConnectionManager.js`**

Update `DEFAULT_RTC_CONFIG` to:
```javascript
export const DEFAULT_RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 2,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "node --test test/peerConnectionManager.test.mjs"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add p2p-app/src/core/rtc/PeerConnectionManager.js p2p-app/test/peerConnectionManager.test.mjs
git commit -m "feat(rtc): configure pure STUN-only ice servers with Cloudflare and Google"
```

---

### Task 2: Native Resolution & 1080p+ Screen Share Pipeline with `contentHint` in `MediaManager.js`

**Files:**
- Modify: `p2p-app/src/core/media/MediaManager.js:50-80`
- Modify: `p2p-app/test/mediaManager.test.mjs`

**Interfaces:**
- Consumes: Browser `navigator.mediaDevices.getDisplayMedia`
- Produces: `startScreenShare(options)` returning high-resolution screen stream with `contentHint = 'detail'`.

- [ ] **Step 1: Write the failing test**

In `p2p-app/test/mediaManager.test.mjs`, add:
```javascript
test('startScreenShare enforces 1080p minimum ideal resolution and applies contentHint detail', async () => {
  let capturedConstraints = null;
  const mockTrack = {
    kind: 'video',
    contentHint: '',
    addEventListener: () => {},
    removeEventListener: () => {},
    stop: () => {}
  };
  const mockStream = {
    getVideoTracks: () => [mockTrack],
    getAudioTracks: () => []
  };
  const mediaManager = new MediaManager({
    mediaDevices: {
      getDisplayMedia: async (constraints) => {
        capturedConstraints = constraints;
        return mockStream;
      }
    }
  });

  const stream = await mediaManager.startScreenShare();
  assert.strictEqual(stream, mockStream);
  assert.strictEqual(capturedConstraints.video.width.ideal, 1920);
  assert.strictEqual(capturedConstraints.video.width.max, 3840);
  assert.strictEqual(capturedConstraints.video.height.ideal, 1080);
  assert.strictEqual(capturedConstraints.video.height.max, 2160);
  assert.strictEqual(mockTrack.contentHint, 'detail');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "node --test test/mediaManager.test.mjs"`
Expected: FAIL

- [ ] **Step 3: Implement high-resolution display constraints and `contentHint = 'detail'` in `MediaManager.js`**

Update `startScreenShare()` in `MediaManager.js` to configure:
```javascript
const defaultDisplayConstraints = {
  video: {
    width: { ideal: 1920, max: 3840 },
    height: { ideal: 1080, max: 2160 },
    frameRate: { ideal: 30, max: 60 },
    displaySurface: 'monitor',
  },
  audio: {
    channelCount: 2,
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false,
  }
};
```
And set `track.contentHint = 'detail'` on the captured video track.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "node --test test/mediaManager.test.mjs"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add p2p-app/src/core/media/MediaManager.js p2p-app/test/mediaManager.test.mjs
git commit -m "feat(media): enhance screen sharing with 1080p-4k constraints and detail contentHint"
```

---

### Task 3: Zoom Control Dock Alignment in `P2PControls.jsx`

**Files:**
- Modify: `p2p-app/src/components/P2PControls.jsx`
- Modify: `p2p-app/src/components/P2PMeetingRoom.jsx`

**Interfaces:**
- Produces: Zoom bottom control dock with Mute (audio meter + chevron), Start Video (virtual background chevron), Security shield popover, Participants pill count, Chat unread badge, Screen Share accent button, Reactions popover, and Red Leave button.

- [ ] **Step 1: Verify and test component rendering and action dispatches**

Inspect `P2PControls.jsx` to ensure all standard Zoom buttons are present and wired to their respective state handlers:
- Mute/Unmute audio level wave meter visualization
- Camera virtual background menu
- Security popover (Lock Room, Toggle Chat, Toggle Share)
- Participants drawer toggle with count badge
- Chat drawer toggle with unread indicator
- Screen share toggle with high-resolution indicator
- Emoji reaction drawer / raise hand
- Crimson leave button

- [ ] **Step 2: Refine Zoom Dock styles and layout tokens in `P2PControls.jsx`**

Apply frosted obsidian glass container styling (`.zoom-dock`) with exact spacing, hover micro-animations, and tooltips matching Zoom desktop UI conventions.

- [ ] **Step 3: Run full tests to verify no regressions**

Run: `cmd.exe /c "npm test"`
Expected: PASS (70+ tests passing)

- [ ] **Step 4: Commit**

```bash
git add p2p-app/src/components/P2PControls.jsx p2p-app/src/components/P2PMeetingRoom.jsx
git commit -m "feat(ui): align bottom control dock with complete Zoom desktop aesthetics"
```

---

### Task 4: Zoom Top Header with E2EE & STUN Diagnostics Modal in `P2PHeader.jsx`

**Files:**
- Modify: `p2p-app/src/components/P2PHeader.jsx`

**Interfaces:**
- Produces: Top bar with green shield security modal (displaying E2EE AES-256-GCM SFrame encryption status, STUN reflexive connectivity diagnostics, zero-cloud confirmation, 1-click invite link copy), session duration timer, and Gallery/Speaker view switcher.

- [ ] **Step 1: Implement Security & STUN Diagnostics Modal in `P2PHeader.jsx`**

Add an interactive security modal opened by clicking the Green Shield:
- Displays "End-to-End Encrypted (AES-256-GCM SFrame)"
- Displays "Zero-Cloud Peer-to-Peer Mesh (STUN: Cloudflare + Google)"
- Displays reflexive public candidate diagnostics
- Displays Room Code with 1-click copy button

- [ ] **Step 2: Connect View Switcher to Grid Layout State**

Ensure the Gallery View (`▦`) and Speaker View (`👤`) buttons update `viewMode` in `P2PMeetingRoom.jsx`.

- [ ] **Step 3: Run test suite**

Run: `cmd.exe /c "npm test"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add p2p-app/src/components/P2PHeader.jsx
git commit -m "feat(ui): add Zoom top header with E2EE and STUN diagnostics modal"
```

---

### Task 5: Zoom Video Canvas, Active Speaker Ring & Signal Strength in `P2PGrid.jsx` & `P2PVideoTile.jsx`

**Files:**
- Modify: `p2p-app/src/components/P2PGrid.jsx`
- Modify: `p2p-app/src/components/P2PVideoTile.jsx`

**Interfaces:**
- Produces: Responsive auto-layout grid, Electric Orange active speaker border (`#FF6B35`), 3-bar signal health indicator, name pills with audio visualizer, and Pin/Hide self-view overlays.

- [ ] **Step 1: Ensure 3-Bar Signal Strength Meter in `P2PVideoTile.jsx`**

Add/refine network quality indicator based on `rtcStats` (Green $\le 80$ms RTT / 0% loss, Yellow $\le 180$ms, Red $> 180$ms / loss).

- [ ] **Step 2: Verify Active Speaker Highlighting in `P2PGrid.jsx`**

Apply `.speaking-halo` (Electric Orange `#FF6B35`) to the active speaker's video tile with smooth CSS transitions.

- [ ] **Step 3: Run test suite**

Run: `cmd.exe /c "npm test"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add p2p-app/src/components/P2PGrid.jsx p2p-app/src/components/P2PVideoTile.jsx
git commit -m "feat(ui): refine Zoom video grid with signal indicators and active speaker ring"
```

---

### Task 6: End-to-End Verification & Build Validation

**Files:**
- Modify: None (verification step)

- [ ] **Step 1: Run complete test suite**

Run: `cmd.exe /c "npm test"` in `p2p-app`.
Expected: All tests pass with zero failures.

- [ ] **Step 2: Run production build**

Run: `cmd.exe /c "npm run build"` in `p2p-app`.
Expected: Static build completes successfully without errors.
