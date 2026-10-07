# Core Module Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `PeerConnectionManager` into Negotiation/Ice/Track modules with explicit contracts, fix the audio/video renegotiation bug, and wire Quality → Topology.

**Architecture:** `PeerConnectionManager` owns a `Map<peerId, PeerEntry>` and composes `NegotiationManager`, `IceManager`, `TrackManager` per peer. `QualityController` emits ordered `action`s; `TopologyManager` is the only consumer that changes peer relationships. `MeetingController` only routes events.

**Tech Stack:** Plain ES modules, `node --test` (`npm test`), fake `RTCPeerConnection` objects (no browser needed).

**Spec:** The architecture in the user's message of 2026-10-07 (TrackManager, TopologyManager above PeerConnection, hierarchical QualityController, Perfect Negotiation module, DataChannel envelope, MQTT ephemeral settings).

## Global Constraints

- Files live under `src/core/<area>/`; tests under `test/*.test.mjs`.
- Every module: `on(event, fn) -> unsubscribe`, `emit` swallows listener errors (existing pattern).
- Quality ladder order is fixed: `bitrate` → `resolution` → `subscription` → `topology` → `reconnect`.
- MQTT signaling: QoS 0, `retain:false`, `clean:true`, endpoint `wss://<host>/mqtt` on 443. No 8084 tunnelling.
- Screen share: `frameRate: { ideal: 60 }` (never `exact`).
- Not built (YAGNI): WASM/volunteer relay, SFU, separate Chat/Whiteboard channel classes (use `type` prefix).

## Review Focus

- Track added after peer connected (mic unmuted/camera enabled late) must reach the remote — `onnegotiationneeded` must fire an offer.
- Both sides negotiate at once (glare) — polite peer rolls back, impolite ignores, no deadlock.
- ICE candidate arrives before remote description, or belongs to an ignored offer — buffered / dropped silently.
- `replaceTrack` must never put a video track on an audio sender (or the reverse), including senders with `track === null`.
- File send larger than the channel buffer must not throw or drop chunks.

---

### Task 1: NegotiationManager (fixes the late-track bug)

**Files:**
- Create: `src/core/rtc/NegotiationManager.js`
- Test: `test/negotiationManager.test.mjs`

**Interfaces:**
- Produces: `new NegotiationManager({ pc, polite, sendSignal })` where `sendSignal(msg)` receives `{type:'offer'|'answer', description}`; methods `handleDescription(description): Promise<void>`; it installs `pc.onnegotiationneeded`.
- Produces property `ignoringOffer: boolean`.

- [ ] **Step 1: Write failing tests** in `test/negotiationManager.test.mjs` using a fake pc (`signalingState`, `setLocalDescription`, `setRemoteDescription`, `createOffer`, `createAnswer`):
  - `negotiationneeded fires sendSignal offer`
  - `polite peer accepts colliding offer (rolls back)`: pc.signalingState='have-local-offer' + incoming offer → `setRemoteDescription` called, answer sent.
  - `impolite peer ignores colliding offer`: no `setRemoteDescription`, `ignoringOffer === true`.
  - `answer is applied without answering`.
- [ ] **Step 2:** Run `node --test test/negotiationManager.test.mjs` → FAIL (module missing).
- [ ] **Step 3: Implement** per MDN perfect negotiation (`makingOffer` flag around `setLocalDescription()`; `offerCollision = offer && (makingOffer || signalingState !== 'stable')`).
- [ ] **Step 4:** Run same command → PASS.
- [ ] **Step 5: Commit** `git add src/core/rtc/NegotiationManager.js test/negotiationManager.test.mjs && git commit -m "feat: NegotiationManager"`

### Task 2: IceManager

**Files:**
- Create: `src/core/rtc/IceManager.js`
- Test: `test/iceManager.test.mjs`

**Interfaces:**
- Consumes: Task 1 `negotiation.ignoringOffer`.
- Produces: `new IceManager({ pc, negotiation, sendCandidate })`; `addRemote(candidate): Promise<void>`; `flush(): Promise<void>` (called after any `setRemoteDescription`); installs `pc.onicecandidate`.

- [ ] **Step 1: Tests:** `buffers until remoteDescription exists`, `flush adds buffered in order`, `drops candidate errors while ignoringOffer`, `local candidate calls sendCandidate`.
- [ ] **Step 2:** Run `node --test test/iceManager.test.mjs` → FAIL.
- [ ] **Step 3: Implement** (move logic from `handleCandidate`/`drainPendingCandidates`; swallow `addIceCandidate` errors only when `negotiation.ignoringOffer`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: IceManager`.

### Task 3: TrackManager

**Files:**
- Create: `src/core/rtc/TrackManager.js`
- Test: `test/trackManager.test.mjs`

**Interfaces:**
- Produces: `new TrackManager()`; `publish(slot, track, stream)` where `slot ∈ 'camera'|'mic'|'screen'`; `unpublish(slot)`; `replace(slot, track)`; `attachTo(pc)` (add senders for all published slots, store `slot → sender`); `detachFrom(pc)`; `snapshot(): {camera, mic, screen}`.
- Operations covered: camera/mic on/off (`replaceTrack(null)` keeps sender), device switch, screen start/stop, screen→camera.

- [ ] **Step 1: Tests:** `publish adds sender on every attached pc`, `replace uses the slot's sender, never another kind`, `unpublish sets sender track to null`, `attachTo gives new peer existing slots`, `screen stop restores camera`.
- [ ] **Step 2:** Run `node --test test/trackManager.test.mjs` → FAIL.
- [ ] **Step 3: Implement** keyed by slot, not by scanning `pc.getSenders()` (this removes the `!sender.track` bug in `replaceTracks`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: TrackManager`.

### Task 4: Recompose PeerConnectionManager

**Files:**
- Modify: `src/core/rtc/PeerConnectionManager.js` (`createPeer`, `handleOffer/Answer/Candidate`, `addTrack`, `replaceTracks`)
- Modify: `test/peerConnectionManager.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces (unchanged public API for callers): `createPeer`, `handleOffer(peerId, offer)`, `handleAnswer`, `handleCandidate`, `removePeer`, `sendData`; **new** `rtc.tracks: TrackManager`; events `signal {peerId, msg}` (replaces direct `createOffer` return use), `iceCandidate`, `track`, `connectionStateChange`.
- `addTrack`/`replaceTracks` stay as thin delegates to `tracks.publish/replace` until Task 8 removes callers.
- `handleCandidate` for unknown peer must NOT create a non-initiator peer with a data channel mismatch: it buffers into a pending map keyed by peerId.

- [ ] **Step 1:** Add tests: `late addTrack triggers an offer signal`, `video replace does not touch audio sender`, `candidate before peer exists is applied after createPeer`. Existing tests stay green.
- [ ] **Step 2:** Run `npm test` → new tests FAIL.
- [ ] **Step 3:** Refactor to compose managers; delete duplicated negotiation/ICE code.
- [ ] **Step 4:** Run `npm test` → all PASS.
- [ ] **Step 5: Commit** `refactor: PeerConnectionManager composes rtc modules`.

### Task 5: QualityController ladder

**Files:**
- Modify: `src/core/quality/QualityController.js` (`sample`)
- Test: `test/qualityController.test.mjs`

**Interfaces:**
- Produces `stats` event payload extended with: `jitter`, `availableBitrate`, `framesDropped`, `qualityLimitationReason`, `fps`, `bufferedAmount`.
- Produces `action` event `{ level: 'bitrate'|'resolution'|'subscription'|'topology'|'reconnect', direction: 'down'|'up' }`. One step per sample; escalates only after `escalateAfter` (default 3) consecutive bad samples at the current level; de-escalates after `recoverAfter` (default 5) good samples.

- [ ] **Step 1: Tests** with fake `getStats` maps: `bad samples escalate one level at a time`, `a single bad sample does nothing`, `recovery steps back down`, `reconnect is the last level`.
- [ ] **Step 2:** Run `node --test test/qualityController.test.mjs` → FAIL.
- [ ] **Step 3: Implement** reading `inbound-rtp`, `outbound-rtp` (`qualityLimitationReason`, `framesDropped`), `candidate-pair` (`availableOutgoingBitrate`, `currentRoundTripTime`), `remote-inbound-rtp` (`jitter`). Keep existing `quality`/`scaleFactor` fields for UI.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat: hierarchical quality actions`.

### Task 6: TopologyManager consumes actions

**Files:**
- Modify: `src/core/topology/TopologyManager.js`; Test: `test/topologyManager.test.mjs`

**Interfaces:**
- Consumes: Task 5 `action`.
- Produces: `applyAction(action)`; `getPlan(): { connect: string[], subscribeVideo: string[] }`; `bitrate`/`resolution` actions call `rtc.tracks` encoder params (`sender.setParameters`), `subscription` shrinks `subscribeVideo` to active speaker + screen sharer, `topology` marks lowest-scored peers audio-only via `MeshStrategy`, `reconnect` emits `reconnectRequested`.

- [ ] **Step 1: Tests:** `subscription action limits video to speaker+sharer`, `topology action drops lowest-scored peer from connect list`, `up direction restores`.
- [ ] **Step 2:** `node --test test/topologyManager.test.mjs` → FAIL.
- [ ] **Step 3:** Implement. Peer score = `isScreenSharing > isSpeaking > isPublishing`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: topology reacts to quality actions`.

### Task 7: DataChannel envelope + backpressure

**Files:**
- Modify: `src/core/data/DataChannelManager.js`, `src/core/rtc/PeerConnectionManager.js` (`sendData`)
- Test: `test/dataChannelManager.test.mjs`

**Interfaces:**
- Produces: `encode(type, payload, sender): {type,id,sender,timestamp,payload}`; `sendFile(channel, transferId, buffer, chunkSize=16384)` async: waits on `bufferedamountlow` when `channel.bufferedAmount > 1 MiB` (`bufferedAmountLowThreshold = 256 KiB`); chunk message `{type:'file.chunk', transferId, sequence, total, payload}`.

- [ ] **Step 1: Tests:** `envelope has all fields`, `sendFile pauses above high-water mark and resumes on bufferedamountlow`, `chunks arrive in sequence with correct total`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat: data envelope and file backpressure`.

### Task 8: MeetingController slimming + signaling settings + screen FPS

**Files:**
- Modify: `src/core/meeting/MeetingController.js` (signal bridge lines 98–160, `replaceStream`)
- Modify: `src/core/signaling/SignalingClient.js` (connect options), `src/core/media/MediaManager.js` (screen constraints)
- Test: `test/meetingController.test.mjs`, `test/signalingClient.test.mjs`, `test/mediaManager.test.mjs`

**Interfaces:**
- `MeetingController` forwards `rtc 'signal'` → `signaling.sendSignal(peerId, msg)`, and `quality 'action'` → `topology.applyAction`. `replaceStream` → `rtc.tracks.replace`.
- `SignalingClient` mqtt options: `{ clean: true, retain: false, qos: 0, resubscribe: false }`; default URL `wss://<host>/mqtt`.
- `getDisplayMedia` video constraint `frameRate: { ideal: 60 }`.

- [ ] **Step 1: Tests:** `publish uses qos 0 retain false`, `getDisplayMedia called with ideal 60`, `quality action reaches topology.applyAction`, `rtc signal is forwarded to signaling`.
- [ ] **Step 2:** `npm test` → new FAIL. **Step 3:** Implement. **Step 4:** `npm test` → all PASS.
- [ ] **Step 5: Commit** `refactor: MeetingController routes only`.

### Task 9: Manual two-browser check

- [ ] Run `npm run dev`; join same room in two browsers; toggle mic off→on and camera off→on **after** connecting; start/stop screen share. Expected: remote audio/video resume each time with no page reload. Check `chrome://webrtc-internals` for `signalingState` returning to `stable`.

---

## Self-Review

- Spec coverage: TrackManager (T3), Topology above PC (T6/8), hierarchical Quality (T5), perfect negotiation module (T1/2/4), DataChannel envelope+backpressure (T7), MQTT ephemeral + 443 + ideal 60fps (T8). Gap by design: sub-channel classes and SFU/relay (YAGNI).
- Types consistent: `rtc.tracks`, `applyAction`, `action {level,direction}`, `signal {peerId,msg}` used identically across tasks.
- Proportion: interfaces and test names only.
