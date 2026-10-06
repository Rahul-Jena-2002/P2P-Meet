/*
 * p2pmeet - Decentralized Privacy-First Video Meetings
 * Global WebRTC Mesh with Zero-Config MQTT over WebSocket Signaling
 * Works seamlessly on Cloudflare Pages, mobile devices, and local dev
 */
import mqtt from 'mqtt';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' }
];

export class P2PMesh {
  constructor({ roomId, userId, userName, stream, onPeerJoin, onPeerLeave, onStream, onData, onError }) {
    this.roomId = (roomId || 'default').trim().toUpperCase();
    this.userId = userId;
    this.userName = userName;
    this.stream = stream;
    this.onPeerJoin = onPeerJoin;
    this.onPeerLeave = onPeerLeave;
    this.onStream = onStream;
    this.onData = onData;
    this.onError = onError;

    this.mqttClient = null;
    this.localWs = null;
    this.peers = new Map(); // targetId -> { pc, queue, stream, name }
    this.isDestroyed = false;
    this.knownPeers = new Set();

    this.broadcastTopic = `p2pmeet/r/${this.roomId}/all`;
    this.peerTopic = `p2pmeet/r/${this.roomId}/p/${this.userId}`;
  }

  connect() {
    if (typeof window === 'undefined') return;

    // Use Public High-Availability WSS MQTT Broker for global signaling
    // Fallback: EMQX global public broker (99.99% uptime, port 8084 WSS)
    const mqttBrokerUrl = 'wss://broker.emqx.io:8084/mqtt';
    const clientId = `p2p_${this.userId}_${Math.random().toString(16).slice(2, 8)}`;

    console.log('[P2P] Connecting to global signaling mesh:', mqttBrokerUrl, 'Room:', this.roomId);

    try {
      this.mqttClient = mqtt.connect(mqttBrokerUrl, {
        clientId,
        keepalive: 30,
        clean: true,
        reconnectPeriod: 2500,
        connectTimeout: 10000
      });

      this.mqttClient.on('connect', () => {
        if (this.isDestroyed) return;
        console.log('[P2P] Connected to global signaling mesh. Joining room:', this.roomId);

        // 1. Subscribe to room broadcast and direct peer signals
        this.mqttClient.subscribe([this.broadcastTopic, this.peerTopic], (err) => {
          if (err) {
            console.warn('[P2P] Subscription warning:', err);
            return;
          }

          // 2. Announce presence to all peers in this room
          this.broadcastSignaling({
            type: 'user-joined',
            userId: this.userId,
            userName: this.userName
          });
        });
      });

      this.mqttClient.on('message', async (topic, message) => {
        if (this.isDestroyed) return;
        try {
          const payload = JSON.parse(message.toString());
          await this.handleIncomingMessage(topic, payload);
        } catch (e) {
          console.warn('[P2P] Malformed signaling message:', e);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.warn('[P2P] Signaling mesh error:', err);
      });

      this.mqttClient.on('close', () => {
        console.log('[P2P] Signaling connection closed');
      });
    } catch (err) {
      console.warn('[P2P] MQTT init error:', err);
      this.onError?.(err);
    }
  }

  async handleIncomingMessage(topic, msg) {
    const { type, senderId, senderName, userId, userName } = msg;

    // Ignore self-published messages
    const originId = senderId || userId;
    if (originId === this.userId) return;

    if (topic === this.broadcastTopic) {
      switch (type) {
        case 'user-joined': {
          // A new peer joined. Acknowledge them and trigger peer connection
          console.log(`[P2P] Peer joined: ${userName} (${userId})`);
          this.knownPeers.add(userId);
          this.onPeerJoin?.(userId, userName);

          // Reply with our presence so the new peer discovers us
          this.sendDirectSignaling(userId, {
            type: 'announce-presence',
            userId: this.userId,
            userName: this.userName
          });

          // Initiator: Peer with alphabetically smaller ID initiates the offer to avoid collision
          if (this.userId < userId) {
            console.log(`[P2P] Initiating offer to new peer ${userName}`);
            await this.createPeerConnection(userId, userName, true);
          }
          break;
        }

        case 'user-left': {
          console.log(`[P2P] Peer left: ${userId}`);
          this.closePeer(userId);
          this.onPeerLeave?.(userId);
          break;
        }

        // Room-wide data broadcast (chat, reaction, watch sync, etc.)
        default: {
          this.onData?.(msg);
          break;
        }
      }
    } else if (topic === this.peerTopic) {
      // Direct peer-to-peer signaling message
      switch (type) {
        case 'announce-presence': {
          console.log(`[P2P] Received presence from existing peer ${userName} (${userId})`);
          this.knownPeers.add(userId);
          this.onPeerJoin?.(userId, userName);

          if (this.userId < userId) {
            console.log(`[P2P] Initiating offer to existing peer ${userName}`);
            await this.createPeerConnection(userId, userName, true);
          }
          break;
        }

        case 'signal': {
          const { signalData } = msg;
          await this.handlePeerSignal(senderId, senderName, signalData);
          break;
        }

        default:
          break;
      }
    }
  }

  async createPeerConnection(targetId, targetName, isInitiator) {
    if (this.peers.has(targetId)) {
      return this.peers.get(targetId).pc;
    }

    console.log(`[P2P] Creating RTCPeerConnection for ${targetName} (${targetId}), isInitiator=${isInitiator}`);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remoteStream = new MediaStream();
    const candidateQueue = [];

    this.peers.set(targetId, { pc, queue: candidateQueue, stream: remoteStream, name: targetName });

    // Add local media tracks if available
    if (this.stream && this.stream.getTracks().length > 0) {
      this.stream.getTracks().forEach((track) => {
        pc.addTrack(track, this.stream);
      });
    } else {
      // Allow receiving incoming video/audio even if local camera/mic is off
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch (e) {
        console.warn('[P2P] Transceiver error:', e);
      }
    }

    // ICE Candidate handler
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal(targetId, {
          candidate: e.candidate.toJSON()
        });
      }
    };

    // Remote Track handler
    pc.ontrack = (e) => {
      console.log(`[P2P] Received remote track from ${targetName}:`, e.track?.kind);
      if (e.streams && e.streams[0]) {
        e.streams[0].getTracks().forEach((track) => {
          if (!remoteStream.getTracks().includes(track)) {
            remoteStream.addTrack(track);
          }
        });
      } else if (e.track) {
        if (!remoteStream.getTracks().includes(e.track)) {
          remoteStream.addTrack(e.track);
        }
      }
      this.onStream?.(targetId, remoteStream, targetName);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[P2P] Peer ${targetName} connection state:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.onStream?.(targetId, remoteStream, targetName);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
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
      await this.createPeerConnection(senderId, senderName, false);
      peerObj = this.peers.get(senderId);
    }
    if (!peerObj) return;

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
          console.warn('[P2P] Queued ICE candidate error:', e);
        }
      }

      // If we received an offer, reply with an answer
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
          console.warn('[P2P] Add ICE candidate error:', e);
        }
      } else {
        queue.push(data.candidate);
      }
    }
  }

  sendSignal(targetId, signalData) {
    this.sendDirectSignaling(targetId, {
      type: 'signal',
      senderId: this.userId,
      senderName: this.userName,
      signalData
    });
  }

  sendDirectSignaling(targetId, payload) {
    if (this.mqttClient && this.mqttClient.connected) {
      const topic = `p2pmeet/r/${this.roomId}/p/${targetId}`;
      this.mqttClient.publish(topic, JSON.stringify(payload));
    }
  }

  broadcastSignaling(payload) {
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(this.broadcastTopic, JSON.stringify(payload));
    }
  }

  broadcast(payload) {
    // Broadcast user messages (chat, reaction, watch together, remote mouse)
    this.broadcastSignaling({
      roomId: this.roomId,
      senderId: this.userId,
      senderName: this.userName,
      ...payload
    });
  }

  replaceStream(newStream) {
    this.stream = newStream;
    this.peers.forEach(({ pc }) => {
      const senders = pc.getSenders();
      const videoTrack = newStream?.getVideoTracks()[0];
      const audioTrack = newStream?.getAudioTracks()[0];

      senders.forEach((sender) => {
        if (sender.track?.kind === 'video' && videoTrack) {
          sender.replaceTrack(videoTrack).catch(() => {});
        } else if (sender.track?.kind === 'audio' && audioTrack) {
          sender.replaceTrack(audioTrack).catch(() => {});
        }
      });
    });
  }

  closePeer(targetId) {
    if (this.peers.has(targetId)) {
      const { pc } = this.peers.get(targetId);
      try {
        pc.close();
      } catch (e) {}
      this.peers.delete(targetId);
      this.knownPeers.delete(targetId);
    }
  }

  destroy() {
    this.isDestroyed = true;

    // Notify room of departure
    this.broadcastSignaling({
      type: 'user-left',
      userId: this.userId
    });

    this.peers.forEach(({ pc }) => {
      try { pc.close(); } catch (e) {}
    });
    this.peers.clear();

    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch (e) {}
      this.mqttClient = null;
    }
  }
}
