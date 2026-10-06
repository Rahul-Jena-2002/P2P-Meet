/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Native WebRTC Mesh with Local Wi-Fi WebSocket Signaling
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

export class P2PMesh {
  constructor({ roomId, userId, userName, stream, onPeerJoin, onPeerLeave, onStream, onData, onError }) {
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.stream = stream;
    this.onPeerJoin = onPeerJoin;
    this.onPeerLeave = onPeerLeave;
    this.onStream = onStream;
    this.onData = onData;
    this.onError = onError;

    this.ws = null;
    this.peers = new Map(); // targetId -> { pc, queue, stream }
    this.isDestroyed = false;
  }

  connect() {
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname || 'localhost';
    const wsUrl = `ws://${hostname}:3001`;

    console.log('[P2P] Connecting to signaling server at:', wsUrl);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[P2P] Connected to signaling server');
      this.ws.send(JSON.stringify({
        type: 'join-room',
        roomId: this.roomId,
        userId: this.userId,
        userName: this.userName
      }));
    };

    this.ws.onerror = (err) => {
      console.error('[P2P] Signaling connection error:', err);
      this.onError?.(err);
    };

    this.ws.onclose = () => {
      console.log('[P2P] Signaling connection closed');
    };

    this.ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        await this.handleSignalingMessage(msg);
      } catch (e) {
        console.error('[P2P] Error handling signaling message:', e);
      }
    };
  }

  async handleSignalingMessage(msg) {
    const { type } = msg;

    switch (type) {
      case 'all-users': {
        // Users already in the room: initiate call to each
        const users = msg.users || [];
        for (const u of users) {
          if (u.userId !== this.userId) {
            this.onPeerJoin?.(u.userId, u.userName);
            await this.createPeerConnection(u.userId, u.userName, true);
          }
        }
        break;
      }

      case 'user-joined': {
        // A new user joined: wait for their offer
        if (msg.userId !== this.userId) {
          this.onPeerJoin?.(msg.userId, msg.userName);
          await this.createPeerConnection(msg.userId, msg.userName, false);
        }
        break;
      }

      case 'signal': {
        const { senderId, senderName, signalData } = msg;
        await this.handlePeerSignal(senderId, senderName, signalData);
        break;
      }

      case 'chat':
      case 'reaction': {
        this.onData?.(msg);
        break;
      }

      case 'user-left': {
        this.closePeer(msg.userId);
        this.onPeerLeave?.(msg.userId);
        break;
      }
    }
  }

  async createPeerConnection(targetId, targetName, isInitiator) {
    if (this.peers.has(targetId)) {
      return this.peers.get(targetId).pc;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remoteStream = new MediaStream();
    const candidateQueue = [];

    this.peers.set(targetId, { pc, queue: candidateQueue, stream: remoteStream, name: targetName });

    // Add local tracks to peer connection
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        pc.addTrack(track, this.stream);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal(targetId, {
          candidate: e.candidate.toJSON()
        });
      }
    };

    // Track handler
    pc.ontrack = (e) => {
      console.log(`[P2P] Received track from ${targetId}:`, e.track.kind);
      e.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      this.onStream?.(targetId, remoteStream, targetName);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[P2P] Connection with ${targetId}:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.closePeer(targetId);
        this.onPeerLeave?.(targetId);
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignal(targetId, { sdp: pc.localDescription });
      } catch (err) {
        console.error(`[P2P] Error creating offer to ${targetId}:`, err);
      }
    }

    return pc;
  }

  async handlePeerSignal(senderId, senderName, data) {
    let peerObj = this.peers.get(senderId);
    if (!peerObj) {
      const pc = await this.createPeerConnection(senderId, senderName, false);
      peerObj = this.peers.get(senderId);
    }

    const { pc, queue } = peerObj;

    if (data.sdp) {
      const description = new RTCSessionDescription(data.sdp);
      await pc.setRemoteDescription(description);

      // Drain queued ICE candidates
      while (queue.length > 0) {
        const cand = queue.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[P2P] Error adding queued ICE candidate:', e);
        }
      }

      // If we received an offer, create and send an answer
      if (description.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(senderId, { sdp: pc.localDescription });
      }
    } else if (data.candidate) {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('[P2P] Error adding ICE candidate:', e);
        }
      } else {
        queue.push(data.candidate);
      }
    }
  }

  sendSignal(targetId, signalData) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'signal',
        targetId,
        senderId: this.userId,
        senderName: this.userName,
        signalData
      }));
    }
  }

  broadcast(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        roomId: this.roomId,
        ...payload
      }));
    }
  }

  replaceStream(newStream) {
    this.stream = newStream;
    this.peers.forEach(({ pc }) => {
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      const newVideoTrack = newStream?.getVideoTracks()[0];
      if (videoSender && newVideoTrack) {
        videoSender.replaceTrack(newVideoTrack);
      }
    });
  }

  closePeer(targetId) {
    const peerObj = this.peers.get(targetId);
    if (peerObj) {
      peerObj.pc.close();
      this.peers.delete(targetId);
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
