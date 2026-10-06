/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

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

    this.peer = null;
    this.calls = new Map(); // peerId -> call
    this.connections = new Map(); // peerId -> dataConnection
    this.isDestroyed = false;
  }

  async connect() {
    if (typeof window === 'undefined') return;

    // Dynamically import PeerJS (client-only)
    const { Peer } = await import('peerjs');

    // Deterministic peer ID for room coordination
    const peerId = `openmeet-${this.roomId}-${this.userId}`;

    this.peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log('[P2P] Connected to mesh with ID:', id);
      this.discoverPeers();
    });

    // Handle incoming media call
    this.peer.on('call', (call) => {
      console.log('[P2P] Incoming call from:', call.peer);
      call.answer(this.stream);

      call.on('stream', (remoteStream) => {
        console.log('[P2P] Received stream from:', call.peer);
        const remotePeerId = call.peer.replace(`openmeet-${this.roomId}-`, '');
        this.calls.set(call.peer, call);
        this.onStream?.(remotePeerId, remoteStream, call.metadata?.userName || 'Participant');
      });

      call.on('close', () => {
        const remotePeerId = call.peer.replace(`openmeet-${this.roomId}-`, '');
        this.calls.delete(call.peer);
        this.onPeerLeave?.(remotePeerId);
      });
    });

    // Handle incoming data connection (chat, reactions, mute)
    this.peer.on('connection', (conn) => {
      this.setupDataConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('[P2P] Peer error:', err);
      if (err.type === 'unavailable-id') {
        // Regenerate unique peer ID if collision
        this.peer.destroy();
        this.userId = `${this.userId}-${Math.floor(Math.random() * 1000)}`;
        this.connect();
      } else {
        this.onError?.(err);
      }
    });
  }

  setupDataConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      const remotePeerId = conn.peer.replace(`openmeet-${this.roomId}-`, '');
      this.onPeerJoin?.(remotePeerId, conn.metadata?.userName || 'Participant');

      // Send initial handshake
      conn.send({
        type: 'HANDSHAKE',
        senderId: this.userId,
        senderName: this.userName
      });
    });

    conn.on('data', (data) => {
      this.onData?.(data);
    });

    conn.on('close', () => {
      const remotePeerId = conn.peer.replace(`openmeet-${this.roomId}-`, '');
      this.connections.delete(conn.peer);
      this.onPeerLeave?.(remotePeerId);
    });
  }

  // Probe or connect directly to room members
  async discoverPeers() {
    // Probe peers or listen for incoming mesh connections
    console.log('[P2P] Mesh listening for peers in room:', this.roomId);
  }

  // Connect to another known peer in the room
  callPeer(targetUserId, targetName) {
    if (!this.peer || this.peer.destroyed) return;
    const targetPeerId = `openmeet-${this.roomId}-${targetUserId}`;

    // Establish Data Connection
    const conn = this.peer.connect(targetPeerId, {
      metadata: { userName: this.userName }
    });
    this.setupDataConnection(conn);

    // Establish Media Call
    if (this.stream) {
      const call = this.peer.call(targetPeerId, this.stream, {
        metadata: { userName: this.userName }
      });

      call.on('stream', (remoteStream) => {
        this.calls.set(targetPeerId, call);
        this.onStream?.(targetUserId, remoteStream, targetName);
      });

      call.on('close', () => {
        this.calls.delete(targetPeerId);
        this.onPeerLeave?.(targetUserId);
      });
    }
  }

  broadcast(data) {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }

  replaceStream(newStream) {
    this.stream = newStream;
    this.calls.forEach((call) => {
      const senders = call.peerConnection?.getSenders() || [];
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      const newVideoTrack = newStream?.getVideoTracks()[0];
      if (videoSender && newVideoTrack) {
        videoSender.replaceTrack(newVideoTrack);
      }
    });
  }

  destroy() {
    this.isDestroyed = true;
    this.calls.forEach(call => call.close());
    this.connections.forEach(conn => conn.close());
    this.calls.clear();
    this.connections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
