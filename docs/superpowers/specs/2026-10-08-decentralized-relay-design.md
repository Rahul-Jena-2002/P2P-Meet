# Decentralized Relay (SFU) Architecture

## Purpose
To reduce the massive upload bandwidth required by a Full Mesh peer-to-peer network (where a user must upload their video $N-1$ times). This architecture elects a "Supernode" (a user with high bandwidth and CPU capacity) to act as a decentralized Selective Forwarding Unit (SFU). Weaker devices upload their streams only once to the Supernode, which then forwards the streams to the rest of the participants.

## Constraints & Limitations
- **Latency Trade-off:** Relayed streams inherently add a small amount of latency (ping from Sender -> Supernode -> Receiver) compared to direct peer connections (Sender -> Receiver), but this is vastly outweighed by the prevention of packet loss and frame drops that occur when a weak device's upload pipe is saturated.
- **Dynamic Re-election:** If the Supernode leaves or their internet degrades, the network must gracefully elect a new Supernode and reparent the streams without dropping the call.

## Architecture

### 1. Peer Capacity Estimation (`RelayCapacityEstimator.js`)
Each client continuously evaluates its own capacity to act as a relay:
- **Metrics:** Upload bandwidth (measured via WebRTC `getStats`), CPU load, battery status, and device type.
- **Constraints:** Mobile devices and laptops on low battery are permanently disqualified from acting as relays.
- **Score:** A composite `relayScore` is calculated. The peer with the highest score is the primary candidate for the Supernode role.

### 2. Network Topology & Tree Strategy (`TopologyManager.js` & `RelayTreeStrategy.js`)
The network transitions from Full Mesh to Relay Tree dynamically:
- **Small Rooms ($N \le 4$):** Full Mesh remains active as it provides the lowest latency and is easily handled by modern connections.
- **Large Rooms ($N > 4$):** The `RelayTreeStrategy` engages. The `TopologyManager` receives heartbeats containing each peer's `relayScore`. It selects the highest-scoring peer(s) as level-1 relays.
- **Routing Assignment:** The `TopologyManager` maps which peers connect directly (to upload) and which peers connect to the Supernode (to download).

### 3. Media Forwarding (`ForwardingBridge.js`)
When a peer acts as a relay:
- It receives an incoming `MediaStreamTrack` from a sender.
- Instead of rendering it, it attaches that track to its outgoing `RTCPeerConnection`s facing the downstream receivers.
- *Integration Note:* This requires careful management of `Transceivers` to ensure the forwarded tracks are marked as `recvonly` on the sender side and `sendonly` on the relay side.

### 4. Failure Recovery (`Rebalancer.js` & `FailureDetector.js`)
- The `FailureDetector` monitors WebRTC connection states and heartbeat timeouts.
- If a Supernode disconnects, the `Rebalancer` instantly triggers an election for the next highest-scoring node and instructs the sender to begin transmitting to the new Supernode.

## Integration Plan
1. Re-integrate the recently restored `TopologyManager`, `TrackManager`, and `ForwardingBridge` into `MeetingController.js`.
2. Connect the `FailureDetector` to the signaling layer.
3. Update `P2PMeetingRoom.jsx` UI to visually indicate if a user is connected via a "Direct Connection" or a "Relay Node" for debugging and transparency.
