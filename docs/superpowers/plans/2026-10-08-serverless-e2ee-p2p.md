# Serverless E2EE P2P Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the decentralized application into a true zero-trust, serverless, E2EE topology where rooms use public mailboxes for signaling and intermediate relays forward encrypted media without the keys.

**Architecture:** A hybrid mesh/SFU topology operating over purely public bootstrap infrastructure (Nostr/MQTT). Ephemeral WebCrypto keys drive E2EE SFrame payloads over WebRTC insertable streams (`RTCRtpScriptTransform`), ensuring relays pass raw ciphertexts. Failures are handled via SWIM-style gossip and deterministic standby promotion.

**Tech Stack:** Next.js / React 19, WebRTC (`RTCPeerConnection`, `RTCRtpScriptTransform`, `RTCEncodedVideoFrame`), WebCrypto API (AES-GCM, ECDH, HKDF), Node.js test runner (`node --test`).

**Spec:** `docs/superpowers/plans/2026-10-08-serverless-e2ee-p2p.md`

## Global Constraints

- Pure web browser implementation: browser-first, rooms ≤50, link-only join, 24 h expiry, no TURN, no owned server.
- The room secret MUST NEVER leave the browser (URL hash fragment).
- Honest limit: Rooms where every peer is behind symmetric NAT cannot connect; the app MUST detect and state this clearly.
- Media limits: Opus mic mono 32-48 kbps with FEC. Screen audio stereo VBR 128-192 kbps, DSP off. Simulcast (3 layers).
- All tests run via `node --test` with 100% pass rate.

## Review Focus

1. **Malicious Mailbox MITM:** If a public Nostr/MQTT broker tampers with the SDP or ICE candidates, the DTLS fingerprint signature validation MUST fail and reject the connection.
2. **Relay decryption attempt:** An elected supernode relay attempting to decode or read `RTCEncodedVideoFrame` data MUST only see AES-GCM ciphertext, preventing any central snooping.
3. **Rekeying on peer leave:** When a participant is removed or drops, a new epoch MUST be ratcheted and new media keys distributed so the dropped peer cannot decrypt subsequent frames.
4. **All-Symmetric NAT failure:** When `NatClassifier` marks all peers as `restricted` with no `reachable` node available, the system MUST gracefully display a "cannot connect" message within 15 seconds rather than hanging infinitely.
5. **Standby promotion race conditions:** If an elected relay dies, the gossip protocol MUST deterministically promote the standby in under 3 seconds without split-brain routing loops.

---

### Task 1: Bootstrap & Signaling Mailbox

**Files:**
- Create: `p2p-app/src/core/signaling/SignalingMailbox.js`
- Create: `p2p-app/src/core/crypto/KeyManager.js`
- Test: `p2p-app/test/signalingMailbox.test.mjs`

**Interfaces:**
- Consumes: Room secret from URL hash (`/r/<roomId>#<secret>`)
- Produces: HKDF-derived mailbox topics, ephemeral P-256 signing keys, and securely signed SDP/ICE payloads.

- [ ] **Step 1: Write the failing test**
  - In `p2p-app/test/signalingMailbox.test.mjs`, write tests verifying `KeyManager` derives the topic from the secret.
  - Write test that a tampered SDP fails fingerprint signature validation.
- [ ] **Step 2: Run test to verify it fails**
  - Run `node --test test/signalingMailbox.test.mjs`
- [ ] **Step 3: Implement `KeyManager.js` and `SignalingMailbox.js`**
  - Use `crypto.subtle` to generate ephemeral P-256 ECDSA and ECDH keys.
  - Implement HKDF to derive MAC keys and Nostr/MQTT topics.
  - Sign DTLS fingerprints before publishing via mailbox.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: SFrame Transform & Encoded-Frame Forwarding (The Spike & Foundation)

**Files:**
- Create: `p2p-app/src/core/media/SFrameTransform.js`
- Modify: `p2p-app/src/core/rtc/PeerConnectionManager.js`
- Modify: `p2p-app/src/core/relay/ForwardingBridge.js`
- Test: `p2p-app/test/sframeTransform.test.mjs`

**Interfaces:**
- Consumes: `RTCRtpSender` / `RTCRtpReceiver` encoded streams.
- Produces: AES-GCM encrypted `RTCEncodedVideoFrame` / `RTCEncodedAudioFrame` payloads, bypassing `addTrack`.

- [ ] **Step 1: Write the failing test**
  - In `p2p-app/test/sframeTransform.test.mjs`, create a mock stream of encoded frames.
  - Verify that `ForwardingBridge` pipes the ciphertext directly from the receiver transform to the sender transform.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `SFrameTransform` and modify `ForwardingBridge`**
  - Build `SFrameTransform.js` utilizing `RTCRtpScriptTransform` to apply AES-GCM encryption/decryption in a worker or main thread.
  - In `ForwardingBridge.js`, replace `addTrack(remoteTrack)` with encoded-frame piping.
  - In `PeerConnectionManager.js`, drop the legacy 510kbps CBR munge and attach transform hooks.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 3: Key Distribution & Epoch Rekeying

**Files:**
- Modify: `p2p-app/src/core/crypto/KeyManager.js`
- Modify: `p2p-app/src/core/meeting/MeetingController.js`
- Test: `p2p-app/test/keyManager.test.mjs`

**Interfaces:**
- Consumes: Join/Leave events from topology.
- Produces: Per-sender media keys distributed over pairwise ECDH channels; epoch hash ratcheting.

- [ ] **Step 1: Write the failing test**
  - Assert that when a peer leaves, a new epoch is generated, and the removed peer's ECDH key is invalidated.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Epoch Rekeying**
  - Update `KeyManager` to manage sender-specific keys.
  - On `peerLeave`, advance the epoch, generate new sender keys, and distribute via the control plane `KEY(epoch, sender)` data channel.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 4: NAT Classification & Connectivity Recovery

**Files:**
- Create: `p2p-app/src/core/topology/NatClassifier.js`
- Modify: `p2p-app/src/core/rtc/PeerConnectionManager.js`
- Test: `p2p-app/test/natClassifier.test.mjs`

**Interfaces:**
- Consumes: STUN responses from `stun.l.google.com` and a Cloudflare STUN server.
- Produces: Labels `reachable` (different IPs/ports match) or `restricted` (symmetric mapping).

- [ ] **Step 1: Write the failing test**
  - Verify `NatClassifier` marks as `restricted` when mapped ports differ across two STUN servers.
  - Verify meeting room emits a "cannot connect" state in ≤15s if all peers are restricted.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `NatClassifier`**
  - Fire requests to two different STUN servers. Compare mapped IP/Ports.
  - If a connection between A ↔ B fails, identify a `reachable` peer C and route packets A → C → B.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 5: Media Layer Constraints & Last-N Routing

**Files:**
- Modify: `p2p-app/src/core/media/MediaManager.js`
- Modify: `p2p-app/src/core/topology/SubscriptionManager.js`
- Test: `p2p-app/test/mediaConstraints.test.mjs`

**Interfaces:**
- Consumes: Local network bandwidth drops; UI view state.
- Produces: Upstream `SUBSCRIBE(layer)` control messages; simulcast (3 layers).

- [ ] **Step 1: Write the failing test**
  - Assert `SubscriptionManager` dispatches `SUBSCRIBE(layer)` over data channels instead of relying purely on local limits.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Simulcast and Last-N Routing**
  - Update `MediaManager` to negotiate 3-layer simulcast or VP9 SVC.
  - Configure Opus to 32-48kbps mono FEC (mic) and VBR 128-192kbps (screen).
  - Receivers send `SUBSCRIBE(0)` to halt hidden tiles upstream, saving relay bandwidth.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 6: SWIM Gossip & Deterministic Role Election

**Files:**
- Create: `p2p-app/src/core/topology/GossipMembership.js`
- Modify: `p2p-app/src/core/topology/RelaySelector.js`
- Modify: `p2p-app/src/core/topology/Rebalancer.js`
- Test: `p2p-app/test/gossipElection.test.mjs`

**Interfaces:**
- Consumes: PING/ACK gossip packets over data channels.
- Produces: Replicated membership state; deterministic standby promotion.

- [ ] **Step 1: Write the failing test**
  - Verify that a dead relay triggers standby promotion in <3 seconds without requiring a central coordinator.
  - Verify tie-breaking logic (reachability > upload > CPU > RTT > peerId).
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Gossip Membership and Election**
  - Build `GossipMembership.js` to disperse state and heartbeat vectors.
  - Update `RelaySelector` to deterministically elect a head relay and a hot standby per cluster (4-6 peers).
  - Update `Rebalancer` to immediately promote the standby upon failure detection.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 7: Remote-Control Agent & Consent

**Files:**
- Create: `p2p-app/src/core/control/RemoteControlAgent.js`
- Test: `p2p-app/test/remoteControl.test.mjs`

**Interfaces:**
- Consumes: Control plane data channels (encrypted).
- Produces: Verified UI consent prompts and remote macro dispatches.

- [ ] **Step 1: Write the failing test**
  - Verify that a remote control event is dropped if `consentGranted` is false.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `RemoteControlAgent.js`**
  - Bind AES-GCM encrypted remote-control events to UI dispatchers.
  - Implement a mandatory per-session consent lock for remote desktop/mouse control.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**
