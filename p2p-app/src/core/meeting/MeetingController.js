/*
 * OpenMeet Client Core - MeetingController
 * High-level meeting orchestrator coordinating signaling, peer connections, and media.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { SignalingClient } from '../signaling/SignalingClient.js';
import { PeerConnectionManager } from '../rtc/PeerConnectionManager.js';
import { MediaManager } from '../media/MediaManager.js';
import { TrackManager } from '../media/TrackManager.js';
import { QualityController } from '../quality/QualityController.js';
import { DataChannelManager } from '../data/DataChannelManager.js';
import { TopologyManager, MeshStrategy } from '../topology/TopologyManager.js';
import { SubscriptionManager } from '../topology/SubscriptionManager.js';

export class MeetingController {
  constructor({
    roomId,
    userId,
    userName,
    brokerUrl,
    signaling = null,
    rtc = null,
    media = null,
    trackManager = null,
    subscriptionManager = null,
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
    this.trackManager = trackManager || new TrackManager({ userId: this.userId, rtc: this.rtc });
    this.subscriptionManager = subscriptionManager || new SubscriptionManager({ localUserId: this.userId, maxVisibleCards: 9 });

    this.quality = new QualityController({
      getPeers: () => this.rtc?.peers ? Array.from(this.rtc.peers.values()) : []
    });

    this.dataChannels = new DataChannelManager();

    this.topology = new TopologyManager({
      localUserId: this.userId,
      rtc: this.rtc,
      strategy: new MeshStrategy()
    });

    this.participants = new Map(); // userId -> { userId, userName, stream, isMuted, isVideoOff }
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
      this.participants.set(userId, { userId, userName, stream: null, screenStream: null });
      this.emit('peerJoined', { userId, userName });
      this.emit('participantsChanged', this.getParticipants());

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
        this.participants.set(senderId, { userId: senderId, userName: senderName || senderId, stream: null, screenStream: null });
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
      this.rtc.removePeer(userId);
      this.trackManager?.unregisterPeerSources?.(userId);
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
      this.trackManager?.registerRemoteTrack?.({ peerId, track, stream, isScreen: false });
      const participant = this.participants.get(peerId);
      if (participant) {
        participant.stream = stream;
        this.emit('participantStream', { peerId, stream, track });
        this.emit('participantsChanged', this.getParticipants());
      }
    });

    this.rtc.on('screenTrack', ({ peerId, track, stream }) => {
      if (track) {
        this.trackManager?.registerRemoteTrack?.({ peerId, track, stream, isScreen: true });
      } else {
        this.trackManager?.unregisterRemoteSource?.(`${peerId}:screen`);
      }
      const participant = this.participants.get(peerId);
      if (participant) {
        participant.screenStream = stream;
        this.emit('participantScreenStream', { peerId, stream, track });
        this.emit('participantsChanged', this.getParticipants());
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
    this.dataChannels?.destroy?.();
    this.signaling.disconnect();
    this.rtc.destroy();
    this.media.stop();
    this.trackManager?.destroy?.();
    this.participants.clear();
    this.emit('participantsChanged', []);
    this.emit('left');
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

  async replaceStream(newStream, isScreenSharing = false, fallbackAudioStream = null) {
    if (newStream && typeof newStream === 'object' && ('localStream' in newStream || 'screenStream' in newStream)) {
      await this.trackManager?.updateFromStreams?.(newStream);
      const videoTrack = newStream.localStream?.getVideoTracks?.()[0] || null;
      const audioTrack = newStream.localStream?.getAudioTracks?.()[0] || null;
      const screenTrack = newStream.screenStream?.getVideoTracks?.()[0] || null;
      return this.rtc.replaceTracks?.({ audioTrack, videoTrack, screenTrack });
    }

    const videoTrack = newStream?.getVideoTracks?.()[0] || null;
    const audioTrack = fallbackAudioStream?.getAudioTracks?.()[0] || newStream?.getAudioTracks?.()[0] || null;
    const screenTrack = isScreenSharing ? videoTrack : null;
    if (this.trackManager) {
      await this.trackManager.setLocalAudioTrack(audioTrack);
      await this.trackManager.setLocalCameraTrack(isScreenSharing ? null : videoTrack);
      await this.trackManager.setLocalScreenTrack(isScreenSharing ? videoTrack : null);
    }
    await this.rtc.replaceTracks?.({ audioTrack, videoTrack, screenTrack, isScreenSharing });
  }

  getSources() {
    return this.trackManager ? this.trackManager.getAllSources() : [];
  }

  getSource(sourceId) {
    return this.trackManager ? this.trackManager.getSource(sourceId) : null;
  }

  setPeerScreenTrack(peerId, screenTrackId) {
    this.rtc?.setPeerScreenTrack?.(peerId, screenTrackId);
  }

  setPinnedSource(sourceId) {
    this.subscriptionManager?.setPinnedSource(sourceId);
  }

  evaluateSubscriptions(offset = 0) {
    return this.subscriptionManager?.evaluateSubscriptions(this.getSources(), offset) || [];
  }

  getSubscriptions() {
    return this.subscriptionManager?.getActiveSubscriptions() || [];
  }

  destroy() {
    this.leave();
  }
}
