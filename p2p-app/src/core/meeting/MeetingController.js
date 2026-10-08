/*
 * OpenMeet Client Core - MeetingController
 * High-level meeting orchestrator coordinating signaling, peer connections, and media.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerConnectionManager } from '../rtc/PeerConnectionManager.js';
import { MediaManager } from '../media/MediaManager.js';
import { QualityController } from '../quality/QualityController.js';
import { DataChannelManager } from '../data/DataChannelManager.js';
import { TopologyManager } from '../topology/TopologyManager.js';
import { TrackManager } from '../media/TrackManager.js';

export class MeetingController {
  constructor({
    roomId,
    userId,
    userName,
    brokerUrl,
    signaling = null,
    rtc = null,
    media = null,
    onPeerJoin = null,
    onPeerLeave = null,
    onStream = null,
    onScreenStream = null,
    onData = null,
    onNetworkStats = null
  }) {
    this.roomId = (roomId || 'default').trim().toUpperCase();
    this.userId = userId;
    this.userName = userName;

    this.signaling = signaling || new SignalingClient({
      roomId: this.roomId,
      userId: this.userId,
      userName: this.userName,
      brokerUrl
    });

    this.rtc = rtc || new PeerConnectionManager({ myId: this.userId });
    this.media = media || new MediaManager();

    this.quality = new QualityController({
      getPeers: () => this.rtc?.peers ? Array.from(this.rtc.peers.values()) : []
    });

    this.dataChannels = new DataChannelManager();
    this.trackManager = new TrackManager({ userId: this.userId, rtc: this.rtc });
    this.topology = new TopologyManager({
      localUserId: this.userId,
      rtc: this.rtc
    });

    this.participants = new Map(); // userId -> { userId, userName, stream, screenStream, screenAudioStream }
    this.listeners = new Map();

    if (onPeerJoin) this.on('peerJoined', ({ userId, userName }) => onPeerJoin(userId, userName));
    if (onPeerLeave) this.on('peerLeft', ({ userId }) => onPeerLeave(userId));
    if (onStream) this.on('participantStream', ({ peerId, stream }) => onStream(peerId, stream));
    if (onScreenStream) this.on('participantScreenStream', ({ peerId, stream }) => onScreenStream(peerId, stream));
    if (onData) {
      this.on('dataMessage', ({ data }) => onData(data));
      this.signaling.on('data', (data) => onData(data));
      this.signaling.on('peer-direct', (data) => onData(data));
    }
    if (onNetworkStats) {
      this.quality.on('stats', onNetworkStats);
    }
    this.quality.on('stats', (stats) => this.emit('networkStats', stats));

    this.setupSignalingBridges();
    this.setupRtcBridges();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const set = this.listeners.get(event);
    if (set) set.delete(handler);
  }

  emit(event, data) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach(fn => {
        try { fn(data); } catch (e) { console.warn(`[MeetingController] Error in ${event} listener:`, e); }
      });
    }
  }

  setupSignalingBridges() {
    this.signaling.on('peer-joined', async ({ userId, userName }) => {
      this.participants.set(userId, { userId, userName, stream: null, screenStream: null, screenAudioStream: null });
      this.emit('peerJoined', { userId, userName });
      this.emit('participantsChanged', this.getParticipants());
      try {
        this.topology?.evaluatePeer?.({ id: userId, name: userName });
      } catch (_) {}

      try {
        const offer = await this.rtc.createOffer(userId);
        this.signaling.sendSignal(userId, { type: 'offer', offer });
      } catch (err) {
        console.warn(`[MeetingController] Failed creating offer for ${userId}:`, err);
      }
    });

    this.signaling.on('peer-signal', async ({ senderId, senderName, signalData }) => {
      if (!signalData) return;
      const { type, offer, answer, candidate } = signalData;

      if (!this.participants.has(senderId)) {
        this.participants.set(senderId, { userId: senderId, userName: senderName || senderId, stream: null, screenStream: null, screenAudioStream: null });
        try {
          this.topology?.evaluatePeer?.({ id: senderId, name: senderName || senderId });
        } catch (_) {}
        this.emit('participantsChanged', this.getParticipants());
      }

      try {
        if (type === 'offer' && offer) {
          const answerDesc = await this.rtc.handleOffer(senderId, offer);
          if (answerDesc) {
            this.signaling.sendSignal(senderId, { type: 'answer', answer: answerDesc });
          }
        } else if (type === 'answer' && answer) {
          await this.rtc.handleAnswer(senderId, answer);
        } else if (type === 'candidate' && candidate) {
          await this.rtc.handleCandidate(senderId, candidate);
        }
      } catch (err) {
        console.warn(`[MeetingController] Error handling signal from ${senderId}:`, err);
      }
    });

    this.signaling.on('peer-left', ({ userId }) => {
      this.topology?.removePeer?.(userId);
      this.rtc.removePeer(userId);
      this.participants.delete(userId);
      this.emit('participantsChanged', this.getParticipants());
      this.emit('peerLeft', { userId });
    });
  }

  setupRtcBridges() {
    this.rtc.on('iceCandidate', ({ peerId, candidate }) => {
      this.signaling.sendSignal(peerId, { type: 'candidate', candidate });
    });

    this.rtc.on('signal', ({ peerId, msg }) => {
      this.signaling.sendSignal(peerId, msg);
    });

    this.rtc.on('track', ({ peerId, track, stream }) => {
      const participant = this.participants.get(peerId);
      if (participant) {
        participant.stream = stream;
        this.emit('participantStream', { peerId, stream, track });
        this.emit('participantsChanged', this.getParticipants());
      }
    });

    this.rtc.on('screenTrack', ({ peerId, track, stream }) => {
      const participant = this.participants.get(peerId);
      if (participant) {
        participant.screenStream = stream;
        this.emit('participantScreenStream', { peerId, stream, track });
        this.emit('participantsChanged', this.getParticipants());
      }
    });

    this.rtc.on('screenAudioTrack', ({ peerId, track, stream }) => {
      const participant = this.participants.get(peerId);
      if (participant) {
        participant.screenAudioStream = stream;
        participant.screenAudioTrack = track;
        this.emit('participantScreenAudioStream', { peerId, stream, track });
        this.emit('participantsChanged', this.getParticipants());
      }
    });

    this.rtc.on('peerCreated', ({ peerId }) => {
      const peer = this.rtc.getPeer(peerId);
      if (peer?.dataChannel) {
        this.dataChannels.attachChannel(peerId, peer.dataChannel);
      }
    });

    this.rtc.on('dataChannelOpen', ({ peerId }) => {
      const peer = this.rtc.getPeer(peerId);
      if (peer?.dataChannel) {
        this.dataChannels.attachChannel(peerId, peer.dataChannel);
      }
    });

    this.rtc.on('dataMessage', ({ peerId, data }) => {
      this.emit('dataMessage', { peerId, data });
    });
  }

  async join() {
    this.signaling.on('connected', () => this.emit('connected'));
    this.signaling.on('disconnected', () => this.emit('disconnected'));
    this.signaling.connect();
    this.quality.start();
    return true;
  }

  leave() {
    this.quality?.stop?.();
    this.signaling.disconnect();
    this.rtc.destroy();
    this.media.stop();
    this.cleanupAudioMixer();
    this.dataChannels?.destroy?.();
    this.trackManager?.destroy?.();
    this.participants.clear();
    this.emit('participantsChanged', []);
    this.emit('left');
  }

  // -----------------------------------------------------------------------
  // Audio Mixer — mic + system audio blending for screen share with audio
  // -----------------------------------------------------------------------
  mixAudioTracks(micTrack, screenAudioTrack) {
    if (!screenAudioTrack) return micTrack;
    if (typeof window === 'undefined') return micTrack;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return micTrack || screenAudioTrack;

    try {
      if (!this.audioMixerCtx || this.audioMixerCtx.state === 'closed') {
        this.audioMixerCtx = new AudioContextClass();
      }
      if (this.audioMixerCtx.state === 'suspended') {
        this.audioMixerCtx.resume().catch(() => {});
      }

      const destination = this.audioMixerCtx.createMediaStreamDestination();

      // Mic gain node — allows mute/unmute without replacing the send track
      this.micGainNode = this.audioMixerCtx.createGain();
      this.micGainNode.gain.value = micTrack ? 1.0 : 0.0;

      if (micTrack) {
        const micSource = this.audioMixerCtx.createMediaStreamSource(new MediaStream([micTrack]));
        micSource.connect(this.micGainNode);
      }
      this.micGainNode.connect(destination);

      const screenSource = this.audioMixerCtx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
      screenSource.connect(destination);

      return destination.stream?.getAudioTracks?.()[0] || micTrack;
    } catch (e) {
      console.warn('[MeetingController] Failed to mix mic and screen audio:', e);
      return screenAudioTrack || micTrack;
    }
  }

  /**
   * Control mic gain in the audio mixer when screen share + system audio is active.
   * @param {boolean} muted
   */
  setMixerMicMuted(muted) {
    if (this.micGainNode) {
      this.micGainNode.gain.setTargetAtTime(muted ? 0.0 : 1.0, this.audioMixerCtx?.currentTime || 0, 0.01);
    }
  }

  cleanupAudioMixer() {
    if (this.audioMixerCtx) {
      try { this.audioMixerCtx.close().catch(() => {}); } catch (_) {}
      this.audioMixerCtx = null;
    }
  }

  getParticipants() {
    return Array.from(this.participants.values());
  }

  sendChatMessage(message) {
    this.rtc.sendData({
      type: 'chat',
      senderId: this.userId,
      senderName: this.userName,
      content: message,
      timestamp: Date.now()
    });
  }

  broadcast(payload) {
    this.signaling.broadcast?.(payload);
    this.rtc.sendData?.(payload);
  }

  sendDirect(targetId, payload) {
    this.signaling.sendDirect?.(targetId, payload);
  }

  /**
   * Replace local media tracks on all peer connections.
   * Accepts either a { localStream, screenStream } object (used by P2PMeetingRoom)
   * or a plain MediaStream (legacy path).
   */
  async replaceStream(newStream, isScreenSharing = false, fallbackAudioStream = null) {
    if (newStream && typeof newStream === 'object' && ('localStream' in newStream || 'screenStream' in newStream)) {
      const videoTrack = newStream.localStream?.getVideoTracks?.()[0] || null;
      const audioTrack = newStream.localStream?.getAudioTracks?.()[0] || null;
      const screenTrack = newStream.screenStream?.getVideoTracks?.()[0] || null;
      const screenAudioTrack = newStream.screenStream?.getAudioTracks?.()[0] || null;

      return this.rtc.replaceTracks?.({ audioTrack, videoTrack, screenTrack, screenAudioTrack });
    }

    // Legacy plain-stream path
    const videoTrack = newStream?.getVideoTracks?.()[0] || null;
    const audioTrack = fallbackAudioStream?.getAudioTracks?.()[0] || newStream?.getAudioTracks?.()[0] || null;
    const screenTrack = isScreenSharing ? videoTrack : null;
    return this.rtc.replaceTracks?.({ audioTrack, videoTrack, screenTrack, isScreenSharing });
  }

  setPeerScreenTrack(peerId, screenTrackId) {
    this.rtc?.setPeerScreenTrack?.(peerId, screenTrackId);
  }

  destroy() {
    this.leave();
  }
}
