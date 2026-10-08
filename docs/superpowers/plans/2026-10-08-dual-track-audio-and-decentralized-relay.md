# Dual-Track High-Fidelity Audio & Decentralized Relay (SFU) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Zoom/Teams-grade dual-track stereo screen audio with 510kbps Opus SDP munging and zero-latency capture, and integrate a decentralized Supernode Relay (SFU) tree for scalable peer forwarding with dynamic failover.

**Architecture:** Transmit separate WebRTC tracks for microphone voice (processed speech) and screen audio (unprocessed high-fidelity stereo with Opus 510kbps SDP parameters). Re-integrate the restored `TopologyManager`, `TrackManager`, `DataChannelManager`, and `ForwardingBridge` into `MeetingController` so rooms dynamically transition from Full Mesh (<= 4 peers) to Supernode Relay Tree (> 4 peers) with automatic node re-election upon peer drop.

**Tech Stack:** Next.js / React 19, WebRTC (`RTCPeerConnection`, `RTCRtpTransceiver`, `RTCStatsReport`), Node.js test runner (`node --test`), Vanilla CSS.

**Spec:** 
- `docs/superpowers/specs/2026-10-08-dual-track-audio-design.md`
- `docs/superpowers/specs/2026-10-08-decentralized-relay-design.md`

## Global Constraints

- Pure web browser implementation: no native OS kernel drivers (macOS screen audio constrained to Browser Tab).
- Screen share audio captured directly with `{ latency: 0, echoCancellation: false, noiseSuppression: false, autoGainControl: false }`.
- Zero local `AudioContext` mixing for screen audio to prevent degradation and latency.
- Opus SDP munging applied to screen audio tracks (`maxaveragebitrate=510000;stereo=1;sprop-stereo=1;cbr=1`).
- Small rooms ($N \le 4$) default to Full Mesh; large rooms ($N > 4$) dynamically elect Supernodes via `RelayCapacityEstimator`.
- All tests run via `node --test` with 100% pass rate.

## Review Focus

1. **SDP Opus codec parameter missing or malformed:** If SDP doesn't contain an existing Opus `fmtp` line, munger must safely append `a=fmtp:<payload> stereo=1;sprop-stereo=1;maxaveragebitrate=510000;cbr=1` rather than crashing.
2. **Missing screen audio track:** User shares screen without checking "Share tab audio". MediaManager must safely handle screen video without audio and not create a dummy dead audio transceiver.
3. **Supernode sudden disconnect:** When elected supernode disconnects abruptly, FailureDetector must trigger Rebalancer within 2 seconds to reparent downstream peers to fallback supernode or fallback to direct mesh.
4. **Glare / renegotiation race condition during track forwarding:** Forwarding bridge attaching tracks to downstream peers must respect `PeerConnectionManager` perfect negotiation (`isPolite`, `makingOffer`, `ignoreOffer`).
5. **Multiple audio elements playback on receiver:** Remote screen audio and voice audio from the same peer must play concurrently without mutual muting or echo loop.

---

### Task 1: High-Fidelity Opus SDP Munging

**Files:**
- Modify: `p2p-app/src/core/rtc/PeerConnectionManager.js`
- Test: `p2p-app/test/peerConnectionManager.test.mjs`

**Interfaces:**
- Consumes: `sdp: string`
- Produces: `mungeSdpForHighFidelityAudio(sdp: string): string` in `PeerConnectionManager.js`

- [ ] **Step 1: Write the failing test**

In `p2p-app/test/peerConnectionManager.test.mjs`, add tests for `mungeSdpForHighFidelityAudio`:
```javascript
test('mungeSdpForHighFidelityAudio injects stereo=1, sprop-stereo=1, and maxaveragebitrate=510000 into Opus fmtp', () => {
  const mockSdp = `v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n`;
  const munged = PeerConnectionManager.mungeSdpForHighFidelityAudio(mockSdp);
  assert.match(munged, /stereo=1/);
  assert.match(munged, /sprop-stereo=1/);
  assert.match(munged, /maxaveragebitrate=510000/);
  assert.match(munged, /cbr=1/);
});

test('mungeSdpForHighFidelityAudio handles SDP without existing fmtp line for opus', () => {
  const mockSdp = `v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\n`;
  const munged = PeerConnectionManager.mungeSdpForHighFidelityAudio(mockSdp);
  assert.match(munged, /a=fmtp:111.*stereo=1.*maxaveragebitrate=510000/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/peerConnectionManager.test.mjs`
Expected: FAIL with `PeerConnectionManager.mungeSdpForHighFidelityAudio is not a function`

- [ ] **Step 3: Implement `mungeSdpForHighFidelityAudio` in `p2p-app/src/core/rtc/PeerConnectionManager.js`**

Implement static method `PeerConnectionManager.mungeSdpForHighFidelityAudio(sdp)`:
- Parse SDP lines, find payload number for `opus/48000/2`.
- If `a=fmtp:<payload>` exists, append `;stereo=1;sprop-stereo=1;maxaveragebitrate=510000;cbr=1` if not already present.
- If `a=fmtp:<payload>` does not exist, insert `a=fmtp:<payload> stereo=1;sprop-stereo=1;maxaveragebitrate=510000;cbr=1` directly after `a=rtpmap:<payload> opus/48000/2`.
- Hook this into `createOffer` and `createAnswer` in `PeerConnectionManager.js` before returning description.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/peerConnectionManager.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add p2p-app/src/core/rtc/PeerConnectionManager.js p2p-app/test/peerConnectionManager.test.mjs
git commit -m "feat(audio): add high-fidelity opus SDP munging for 510kbps stereo"
```

---

### Task 2: Zero-Latency Screen Audio Capture & Dual-Track Audio Transceivers

**Files:**
- Modify: `p2p-app/src/core/media/MediaManager.js`
- Modify: `p2p-app/src/core/rtc/PeerConnectionManager.js`
- Test: `p2p-app/test/mediaManager.test.mjs`
- Test: `p2p-app/test/peerConnectionManager.test.mjs`

**Interfaces:**
- Consumes: `MediaManager.startScreenShare({ audio: true })`
- Produces: `screenAudioTrack: MediaStreamTrack | null`, `PeerConnectionManager.publishScreenAudioTrack(track)` and `PeerConnectionManager.on('screenAudioTrack', ({ peerId, track }))`

- [ ] **Step 1: Write the failing tests**

In `p2p-app/test/mediaManager.test.mjs`:
```javascript
test('MediaManager requests screen share with zero latency and raw audio constraints', async () => {
  let capturedConstraints = null;
  const mockNavigator = {
    mediaDevices: {
      getDisplayMedia: async (constraints) => {
        capturedConstraints = constraints;
        return {
          getVideoTracks: () => [{ id: 'screen-video', stop: () => {} }],
          getAudioTracks: () => [{ id: 'screen-audio', stop: () => {} }],
          getTracks: () => [{ id: 'screen-video', stop: () => {} }, { id: 'screen-audio', stop: () => {} }]
        };
      }
    }
  };
  const media = new MediaManager({ navigator: mockNavigator });
  await media.startScreenShare({ audio: true });
  assert.deepStrictEqual(capturedConstraints.audio, {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    latency: 0
  });
});
```

In `p2p-app/test/peerConnectionManager.test.mjs`:
```javascript
test('PeerConnectionManager identifies screen audio track and dispatches screenAudioTrack event', () => {
  const rtc = new PeerConnectionManager({ myId: 'local' });
  let emitted = false;
  rtc.on('screenAudioTrack', ({ peerId, track }) => {
    emitted = true;
    assert.strictEqual(peerId, 'peer-1');
    assert.strictEqual(track.id, 'screen-audio-1');
  });
  const mockTrack = { id: 'screen-audio-1', kind: 'audio' };
  rtc.setPeerScreenAudioTrack('peer-1', mockTrack);
  assert.strictEqual(emitted, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/mediaManager.test.mjs test/peerConnectionManager.test.mjs`
Expected: FAIL on missing zero-latency constraints and missing `setPeerScreenAudioTrack`.

- [ ] **Step 3: Implement Zero-Latency Screen Audio Capture & Dual-Track Audio in `MediaManager.js` and `PeerConnectionManager.js`**

1. In `MediaManager.js`: Update `startScreenShare(options = {})`:
   - If audio requested, pass `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0 }`.
   - Store `this.localScreenAudioTrack = stream.getAudioTracks()[0] || null`.
   - Provide getter `getLocalScreenAudioTrack()`.
2. In `PeerConnectionManager.js`:
   - Support publishing both `localScreenTrack` (video) and `localScreenAudioTrack` (audio).
   - In `createPeer(peerId)`: Setup dedicated transceiver for screen audio or track sender.
   - Implement `setPeerScreenAudioTrack(peerId, track)` and emit `'screenAudioTrack'` event.
   - In `track` event listener on `pc`: Distinguish screen audio from microphone audio (via stream ID, track label, or signaling metadata) and route to `setPeerScreenAudioTrack`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/mediaManager.test.mjs test/peerConnectionManager.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add p2p-app/src/core/media/MediaManager.js p2p-app/src/core/rtc/PeerConnectionManager.js p2p-app/test/mediaManager.test.mjs p2p-app/test/peerConnectionManager.test.mjs
git commit -m "feat(audio): support zero-latency screen audio acquisition and dual-track rtc transmission"
```

---

### Task 3: Re-integrate DataChannelManager, TopologyManager, and TrackManager into MeetingController

**Files:**
- Modify: `p2p-app/src/core/meeting/MeetingController.js`
- Test: `p2p-app/test/meetingController.test.mjs`

**Interfaces:**
- Consumes: `TopologyManager`, `TrackManager`, `DataChannelManager`
- Produces: `controller.dataChannels`, `controller.topology`, `controller.trackManager` available on `MeetingController`

- [ ] **Step 1: Write the failing test / Verify existing test failure**

Run: `node --test test/meetingController.test.mjs`
Expected: FAIL at `MeetingController integrates QualityController and DataChannelManager` (`assert.ok(controller.dataChannels)`).

- [ ] **Step 2: Implement integration in `p2p-app/src/core/meeting/MeetingController.js`**

1. Import `DataChannelManager` from `../data/DataChannelManager.js`.
2. Import `TopologyManager` from `../topology/TopologyManager.js`.
3. Import `TrackManager` from `../media/TrackManager.js`.
4. In `MeetingController` constructor:
   - Instantiate `this.dataChannels = new DataChannelManager({ rtc: this.rtc, userId: this.userId })`.
   - Instantiate `this.trackManager = new TrackManager({ userId: this.userId })`.
   - Instantiate `this.topology = new TopologyManager({ userId: this.userId, rtc: this.rtc, signaling: this.signaling })`.
   - Bridge data channels message events to `this.emit('dataMessage', ...)`.
   - Hook signaling events for peer joined/left into `this.topology.addPeer(userId)` and `this.topology.removePeer(userId)`.
   - Clean up Web Audio / AudioContext mixing code from `MeetingController.js` (no longer needed since screen audio is sent directly as Track B).
5. Ensure `destroy()` / `cleanup()` tears down `this.dataChannels`, `this.topology`, and `this.trackManager`.

- [ ] **Step 3: Run test to verify it passes**

Run: `node --test test/meetingController.test.mjs`
Expected: PASS with 100% test passes in `meetingController.test.mjs`.

- [ ] **Step 4: Commit**

```bash
git add p2p-app/src/core/meeting/MeetingController.js p2p-app/test/meetingController.test.mjs
git commit -m "feat(core): integrate DataChannelManager, TopologyManager and TrackManager into MeetingController"
```

---

### Task 4: Media Forwarding Bridge & Decentralized Supernode SFU Execution

**Files:**
- Modify: `p2p-app/src/core/rtc/ForwardingBridge.js`
- Modify: `p2p-app/src/core/meeting/MeetingController.js`
- Test: `p2p-app/test/forwardingAndRecovery.test.mjs`

**Interfaces:**
- Consumes: `TopologyManager.on('forwardRequest', ({ sourcePeerId, targetPeerId, trackKind }))`
- Produces: `ForwardingBridge.forwardTrack(sourcePeerId, targetPeerId, track)` attaching forwarded tracks without local mixing

- [ ] **Step 1: Write the failing test**

In `p2p-app/test/forwardingAndRecovery.test.mjs`:
```javascript
test('MeetingController wires ForwardingBridge to forward remote tracks when instructed by topology', async () => {
  const controller = new MeetingController({ roomId: 'ROOM1', userId: 'supernode-1' });
  let forwarded = false;
  controller.forwardingBridge = {
    forwardTrack: (sourceId, targetId, track) => {
      forwarded = true;
      assert.strictEqual(sourceId, 'peer-a');
      assert.strictEqual(targetId, 'peer-b');
    }
  };
  controller.handleForwardInstruction({ sourcePeerId: 'peer-a', targetPeerId: 'peer-b', trackKind: 'video' });
  assert.strictEqual(forwarded, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/forwardingAndRecovery.test.mjs`
Expected: FAIL with `handleForwardInstruction is not a function`.

- [ ] **Step 3: Implement ForwardingBridge wiring in `MeetingController.js` and `ForwardingBridge.js`**

1. In `ForwardingBridge.js`:
   - Support forwarding screen video, screen audio, camera, and mic tracks to target downstream peers using `addTrack` or transceiver matching.
2. In `MeetingController.js`:
   - Instantiate `this.forwardingBridge = new ForwardingBridge({ rtc: this.rtc, trackManager: this.trackManager })`.
   - Connect `this.topology.on('forwardInstruction', (inst) => this.handleForwardInstruction(inst))`.
   - When remote tracks arrive from sender `peerA`, register with `this.trackManager`. If relay is assigned to forward `peerA`'s tracks to `peerB`, call `this.forwardingBridge.forwardTrack(...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/forwardingAndRecovery.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add p2p-app/src/core/rtc/ForwardingBridge.js p2p-app/src/core/meeting/MeetingController.js p2p-app/test/forwardingAndRecovery.test.mjs
git commit -m "feat(relay): wire ForwardingBridge to MeetingController for Supernode stream relay"
```

---

### Task 5: Dynamic Supernode Failover and Rebalancing

**Files:**
- Modify: `p2p-app/src/core/topology/Rebalancer.js`
- Modify: `p2p-app/src/core/topology/FailureDetector.js`
- Modify: `p2p-app/src/core/meeting/MeetingController.js`
- Test: `p2p-app/test/forwardingAndRecovery.test.mjs`

**Interfaces:**
- Consumes: `FailureDetector.on('peerFailed', ({ peerId }))`
- Produces: `Rebalancer.triggerRebalance(topology)` promoting next highest-scoring peer and updating routes

- [ ] **Step 1: Write the failing test**

In `p2p-app/test/forwardingAndRecovery.test.mjs`:
```javascript
test('FailureDetector triggers Rebalancer when supernode disconnects', () => {
  let rebalanceCalled = false;
  const mockTopology = {
    isSupernode: (id) => id === 'super-1',
    electNewSupernode: () => { rebalanceCalled = true; }
  };
  const failureDetector = new FailureDetector({
    checkIntervalMs: 50,
    onSupernodeFailure: () => mockTopology.electNewSupernode()
  });
  failureDetector.reportHeartbeatTimeout('super-1');
  assert.strictEqual(rebalanceCalled, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/forwardingAndRecovery.test.mjs`
Expected: FAIL on `reportHeartbeatTimeout` or callback expectation.

- [ ] **Step 3: Implement FailureDetector & Rebalancer linkage**

1. In `FailureDetector.js`: Add `reportHeartbeatTimeout(peerId)` and connection state monitoring.
2. In `MeetingController.js`:
   - Initialize `FailureDetector`.
   - When a peer leaves or their connection drops, notify `FailureDetector`. If the failed peer was a relay/supernode, trigger `rebalance()` via `Rebalancer.js`, notifying participants of updated routes via signaling.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/forwardingAndRecovery.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add p2p-app/src/core/topology/FailureDetector.js p2p-app/src/core/topology/Rebalancer.js p2p-app/src/core/meeting/MeetingController.js p2p-app/test/forwardingAndRecovery.test.mjs
git commit -m "feat(topology): add failure detection and automatic supernode rebalancing"
```

---

### Task 6: UI Dual-Track Audio Playback & Supernode Network Badge

**Files:**
- Modify: `p2p-app/src/components/P2PMeetingRoom.jsx`
- Modify: `p2p-app/src/components/P2PHeader.jsx`
- Modify: `p2p-app/src/components/P2PControls.jsx`

**Interfaces:**
- Consumes: `MeetingController.on('participantScreenAudioStream')`, `MeetingController.topology.getMode()`, `isSupernode`
- Produces: Rendered `<audio>` elements for stereo screen audio and dynamic status badges in Header ("Mesh P2P" vs "Supernode SFU")

- [ ] **Step 1: Update UI Components**

1. In `P2PMeetingRoom.jsx`:
   - Add state for `participantScreenAudioStreams: Map<peerId, MediaStream>`.
   - Listen for `participantScreenAudioStream` from `MeetingController`.
   - Render hidden `<audio autoPlay playsInline ref={...}>` elements specifically for screen audio streams with `volume` control, ensuring system audio plays in true stereo without routing through microphone processing.
2. In `P2PHeader.jsx`:
   - Add network topology badge: Display whether room is in `Direct Mesh` or `Supernode Relay` mode, and if current user is acting as `Supernode`.
3. In `P2PControls.jsx`:
   - When screen share is active with audio, display a badge/indicator: `"Hi-Fi Stereo Audio (510 kbps)"`.

- [ ] **Step 2: Verify all unit tests pass**

Run: `node --test`
Expected: PASS (all tests in test suite pass cleanly).

- [ ] **Step 3: Build verification**

Run: `npm.cmd run build` (or `npx next build`) in `p2p-app/`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add p2p-app/src/components/P2PMeetingRoom.jsx p2p-app/src/components/P2PHeader.jsx p2p-app/src/components/P2PControls.jsx
git commit -m "feat(ui): add dual-track stereo audio receiver and supernode network status badge"
```
