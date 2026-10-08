# Dual-Track High-Fidelity Audio Architecture

## Purpose
To replicate the native Zoom/Teams screen-share audio quality within the limits of a web browser. The current implementation mixes the microphone and system audio locally using the `AudioContext` API, which degrades quality, ruins stereo sound, and adds latency. This design replaces local mixing with a dual-track WebRTC architecture.

## Constraints & Limitations
- **macOS System Audio:** Web browsers cannot capture macOS system audio natively. Providing a virtual audio driver (like Zoom/Teams) is impossible from a pure web application because browsers cannot install OS-level kernel extensions. macOS users must select "Browser Tab" to share audio.
- **WebRTC Limits:** "Lossless" is not technically possible over WebRTC, but we will force the Opus codec to its maximum high-fidelity stereo bitrate (510 kbps).

## Architecture

### 1. Dual-Track Transmission (`PeerConnectionManager.js`)
Instead of mixing audio, the sender will transmit two separate audio tracks:
- **Track A (Voice):** The user's microphone. Processed by the browser (Echo Cancellation: ON, Noise Suppression: ON, AGC: ON). Sent as standard mono speech.
- **Track B (Screen Audio):** The system/tab audio. Unprocessed (Echo Cancellation: OFF, Noise Suppression: OFF, AGC: OFF). Sent directly to the peer connection to avoid `AudioContext` latency.

### 2. High-Fidelity SDP Munging
To prevent the browser from compressing the screen audio track into low-quality mono, we will intercept the SDP (Session Description Protocol) offer/answer during WebRTC negotiation.
- We will locate the `m=audio` section corresponding to the screen share track.
- We will inject `fmtp` parameters for the Opus codec: `stereo=1; sprop-stereo=1; maxaveragebitrate=510000; cbr=1`.
- This forces the connection into 510kbps Constant Bitrate Stereo mode.

### 3. Receiver Unmixing (`P2PMeetingRoom` & `MeetingController`)
Currently, peers receive one mixed stream. With dual-track, `rtc.on('track')` will fire multiple times.
- The receiving UI must render two separate `<audio>` elements (or attach both to the video element if the browser allows, but separate audio elements are safer).

### 4. Zero Latency Media Acquisition (`MediaManager.js`)
- Screen share audio constraints will explicitly request `{ latency: 0 }`.
- The `AudioContext` mixing logic in `MeetingController.js` will be deleted entirely.

## Success Criteria
- Playing a music video during screen share transmits in clear stereo sound.
- Presenter's voice remains clear without echo.
- No `AudioContext` processing delay on the screen share audio.
