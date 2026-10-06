/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { useMeetingStore } from './useMeetingStore';

class WebRtcManager {
  constructor() {
    this.ws = null;
    this.peerConnections = {}; // { [participantId]: RTCPeerConnection }
    this.iceCandidateQueues = {}; // { [participantId]: RTCIceCandidateInit[] }
    this.remoteStreams = {}; // { [participantId]: MediaStream }
    this.iceServers = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
    ];
  }

  async initialize({ roomId, token, localUser, iceServers }) {
    if (iceServers && iceServers.length > 0) {
      this.iceServers = iceServers;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.port === '5173' ? 'localhost:8080' : window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebRTC] Signaling connected');
        // Join room with token
        this.send({
          type: 'JOIN_ROOM',
          roomId,
          senderId: localUser.participantId,
          payload: { token }
        });
        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('[WebRTC] WebSocket error:', err);
        reject(err);
      };

      this.ws.onclose = (event) => {
        console.log('[WebRTC] Signaling closed:', event.code, event.reason);
        if (event.code === 4001) {
          useMeetingStore.getState().addNotification('You were removed from the meeting by the host', 'error');
          useMeetingStore.getState().resetMeeting();
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const envelope = JSON.parse(event.data);
          await this.handleSignalMessage(envelope);
        } catch (e) {
          console.error('[WebRTC] Error handling message:', e);
        }
      };
    });
  }

  async handleSignalMessage(envelope) {
    const { type, roomId, senderId, targetId, payload } = envelope;
    const store = useMeetingStore.getState();

    switch (type) {
      case 'ROOM_JOINED': {
        const peers = payload.peers || [];
        console.log('[WebRTC] Room joined. Current peers:', peers);
        for (const p of peers) {
          if (p.participantId !== store.localUser.participantId) {
            store.addOrUpdatePeer(p);
            // Initiate WebRTC offer to each existing peer in room
            await this.createPeerConnection(p.participantId, true);
          }
        }
        break;
      }

      case 'PEER_JOINED': {
        const peer = payload.peer;
        if (peer && peer.participantId !== store.localUser.participantId) {
          console.log('[WebRTC] Peer joined:', peer);
          store.addOrUpdatePeer(peer);
          store.addNotification(`${peer.displayName} joined the meeting`, 'info');
          // Wait for incoming offer from newly joined peer
          await this.createPeerConnection(peer.participantId, false);
        }
        break;
      }

      case 'PEER_LEFT': {
        console.log('[WebRTC] Peer left:', senderId);
        this.closePeerConnection(senderId);
        const peer = store.peers[senderId];
        if (peer) {
          store.addNotification(`${peer.displayName} left the meeting`, 'info');
        }
        store.removePeer(senderId);
        break;
      }

      case 'OFFER': {
        const sdp = payload.sdp;
        await this.handleOffer(senderId, sdp);
        break;
      }

      case 'ANSWER': {
        const sdp = payload.sdp;
        await this.handleAnswer(senderId, sdp);
        break;
      }

      case 'ICE_CANDIDATE': {
        const candidate = payload.candidate;
        await this.handleRemoteCandidate(senderId, candidate);
        break;
      }

      case 'MEDIA_STATE': {
        store.addOrUpdatePeer({
          participantId: senderId,
          ...payload
        });
        break;
      }

      case 'CHAT_MESSAGE': {
        store.addChatMessage({
          id: payload.id || Date.now().toString(),
          senderId,
          senderName: payload.senderName || 'Participant',
          content: payload.content,
          timestamp: envelope.timestamp || Date.now()
        });
        break;
      }

      case 'CHAT_HISTORY': {
        if (payload.messages) {
          store.setChatMessages(payload.messages);
        }
        break;
      }

      case 'MUTE_PARTICIPANT': {
        store.addNotification('The host muted your microphone', 'warning');
        if (store.localUser.audioEnabled) {
          store.toggleAudio();
          this.broadcastMediaState();
        }
        break;
      }

      case 'KICK_PARTICIPANT': {
        store.addNotification('You have been removed from the meeting by the host', 'error');
        store.resetMeeting();
        break;
      }

      case 'END_MEETING': {
        store.addNotification('The meeting has been ended by the host', 'warning');
        store.resetMeeting();
        break;
      }

      case 'CONTROL_REQUEST': {
        // Someone requested control over our desktop
        const requester = store.peers[senderId];
        const name = requester ? requester.displayName : 'A participant';
        if (window.confirm(`${name} is requesting remote desktop control. Allow?`)) {
          this.send({
            type: 'CONTROL_APPROVED',
            roomId: store.meeting.code,
            targetId: senderId,
            senderId: store.localUser.participantId,
            payload: { approved: true }
          });
          store.setRemoteControlState({
            status: 'active',
            targetPeerId: senderId,
            isBeingControlled: true
          });
          store.addNotification(`Remote desktop control granted to ${name}`, 'info');
        } else {
          this.send({
            type: 'CONTROL_DENIED',
            roomId: store.meeting.code,
            targetId: senderId,
            senderId: store.localUser.participantId,
            payload: { approved: false }
          });
        }
        break;
      }

      case 'CONTROL_APPROVED': {
        store.setRemoteControlState({
          status: 'active',
          targetPeerId: senderId,
          isControlling: true
        });
        store.addNotification('Remote desktop control approved! You can now control the remote screen.', 'success');
        break;
      }

      case 'CONTROL_DENIED': {
        store.setRemoteControlState({ status: 'idle', targetPeerId: null, isControlling: false });
        store.addNotification('Remote desktop control request was denied', 'warning');
        break;
      }

      case 'CONTROL_REVOKED': {
        store.setRemoteControlState({ status: 'idle', targetPeerId: null, isControlling: false, isBeingControlled: false });
        store.addNotification('Remote desktop control session ended', 'info');
        break;
      }

      case 'CONTROL_EVENT': {
        // Forward to desktop agent or dispatch event
        console.log('[Remote Control Event Received]', payload);
        break;
      }

      default:
        console.log('[WebRTC] Unknown message type:', type);
    }
  }

  async createPeerConnection(peerId, isInitiator) {
    if (this.peerConnections[peerId]) {
      return this.peerConnections[peerId];
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections[peerId] = pc;
    this.iceCandidateQueues[peerId] = [];

    const stream = new MediaStream();
    this.remoteStreams[peerId] = stream;

    // Add local tracks to PeerConnection
    const store = useMeetingStore.getState();
    const localStream = store.screenStream || store.localStream;
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: 'ICE_CANDIDATE',
          roomId: store.meeting.code,
          senderId: store.localUser.participantId,
          targetId: peerId,
          payload: { candidate: event.candidate.toJSON() }
        });
      }
    };

    // Handle incoming remote stream tracks
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received track from ${peerId}:`, event.track.kind);
      event.streams[0].getTracks().forEach(track => {
        stream.addTrack(track);
      });
      store.updatePeerStream(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} state:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.closePeerConnection(peerId);
        store.removePeer(peerId);
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.send({
          type: 'OFFER',
          roomId: store.meeting.code,
          senderId: store.localUser.participantId,
          targetId: peerId,
          payload: { sdp: pc.localDescription }
        });
      } catch (err) {
        console.error(`[WebRTC] Failed to create offer for ${peerId}:`, err);
      }
    }

    return pc;
  }

  async handleOffer(peerId, sdp) {
    let pc = this.peerConnections[peerId];
    if (!pc) {
      pc = await this.createPeerConnection(peerId, false);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    // Drain queued ICE candidates
    await this.drainCandidateQueue(peerId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const store = useMeetingStore.getState();
    this.send({
      type: 'ANSWER',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      targetId: peerId,
      payload: { sdp: pc.localDescription }
    });
  }

  async handleAnswer(peerId, sdp) {
    const pc = this.peerConnections[peerId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.drainCandidateQueue(peerId);
    }
  }

  async handleRemoteCandidate(peerId, candidate) {
    const pc = this.peerConnections[peerId];
    if (!candidate) return;

    // Queue if remote description is not set yet
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      if (!this.iceCandidateQueues[peerId]) this.iceCandidateQueues[peerId] = [];
      this.iceCandidateQueues[peerId].push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn(`[WebRTC] Failed to add ICE candidate for ${peerId}:`, e);
    }
  }

  async drainCandidateQueue(peerId) {
    const pc = this.peerConnections[peerId];
    const queue = this.iceCandidateQueues[peerId] || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn(`[WebRTC] Failed to drain candidate for ${peerId}:`, e);
      }
    }
  }

  // Replace video track across all peer connections (e.g. for screen sharing or camera toggling)
  replaceVideoTrack(newTrack) {
    for (const peerId in this.peerConnections) {
      const pc = this.peerConnections[peerId];
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(newTrack);
      } else if (newTrack) {
        pc.addTrack(newTrack);
      }
    }
  }

  broadcastMediaState() {
    const store = useMeetingStore.getState();
    this.send({
      type: 'MEDIA_STATE',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      payload: {
        audioEnabled: store.localUser.audioEnabled,
        videoEnabled: store.localUser.videoEnabled,
        screenSharing: store.localUser.screenSharing
      }
    });
  }

  sendChatMessage(content) {
    const store = useMeetingStore.getState();
    this.send({
      type: 'CHAT_MESSAGE',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      payload: {
        senderName: store.localUser.displayName,
        content
      }
    });
  }

  muteParticipant(targetId) {
    const store = useMeetingStore.getState();
    this.send({
      type: 'MUTE_PARTICIPANT',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      targetId,
      payload: {}
    });
  }

  kickParticipant(targetId) {
    const store = useMeetingStore.getState();
    this.send({
      type: 'KICK_PARTICIPANT',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      targetId,
      payload: {}
    });
  }

  endMeeting() {
    const store = useMeetingStore.getState();
    this.send({
      type: 'END_MEETING',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      payload: {}
    });
    store.resetMeeting();
  }

  requestRemoteControl(targetId) {
    const store = useMeetingStore.getState();
    store.setRemoteControlState({ status: 'pending_approval', targetPeerId: targetId });
    this.send({
      type: 'CONTROL_REQUEST',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      targetId,
      payload: {}
    });
    store.addNotification('Remote control request sent. Waiting for approval...', 'info');
  }

  revokeRemoteControl(targetId) {
    const store = useMeetingStore.getState();
    this.send({
      type: 'CONTROL_REVOKED',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      targetId,
      payload: {}
    });
    store.setRemoteControlState({ status: 'idle', targetPeerId: null, isControlling: false, isBeingControlled: false });
    store.addNotification('Remote desktop control revoked', 'info');
  }

  sendControlEvent(targetId, eventType, data) {
    const store = useMeetingStore.getState();
    this.send({
      type: 'CONTROL_EVENT',
      roomId: store.meeting.code,
      senderId: store.localUser.participantId,
      targetId,
      payload: { eventType, ...data }
    });
  }

  closePeerConnection(peerId) {
    if (this.peerConnections[peerId]) {
      this.peerConnections[peerId].close();
      delete this.peerConnections[peerId];
    }
    delete this.iceCandidateQueues[peerId];
    delete this.remoteStreams[peerId];
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      data.timestamp = Date.now();
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    for (const peerId in this.peerConnections) {
      this.closePeerConnection(peerId);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const webrtcManager = new WebRtcManager();
