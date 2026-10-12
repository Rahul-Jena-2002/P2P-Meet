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
import { ForwardingBridge } from '../rtc/ForwardingBridge.js';
import { FailureDetector } from '../topology/FailureDetector.js';
import { Rebalancer } from '../topology/Rebalancer.js';

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
    onScreenAudioStream = null,
    onData = null,
    onNetworkStats = null,
    keyManager = null
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
    this.rtc.peerMediaPolicy = (peerId) => this.shouldSendDirectMedia(peerId);
    this.forwardingBridge = new ForwardingBridge({
      trackManager: this.trackManager,
      rtc: this.rtc
    });
    this.relayHeartbeatTimer = null;
    this.relayPeerIds = [];
    this.relayChildren = new Map();
    this.relayDirectFallbackIds = [];

    this.keyManager = keyManager;
    this.failureDetector = new FailureDetector();
    this.rebalancer = new Rebalancer({
      overlayManager: this.topology.overlayManager,
      relaySelector: this.topology.relaySelector,
      localUserId: this.userId
    });

    this.failureDetector.on('nodeFailed', ({ peerId, reason }) => {
      console.warn(`[MeetingController] Node failure detected for ${peerId} (${reason}), rebalancing...`);
      this.rebalancer.handleNodeFailure(peerId);
      this.topology?.removePeer?.(peerId);
      this.emit('nodeRecovered', { failedPeerId: peerId });
    });

    this.topology.overlayManager?.on?.('forwardTrackRequired', ({ sourceId, childPeerId }) => {
      this.forwardSourceToChild(sourceId, childPeerId);
    });
    this.topology.overlayManager?.on?.('forwardTrackStop', ({ sourceId, childPeerId }) => {
      this.forwardingBridge?.stopForwarding?.(sourceId, childPeerId);
    });
    this.trackManager.on('sourceRemoved', ({ sourceId, type }) => {
      const source = this.trackManager?.getSource?.(sourceId);
      const identity = this.trackManager?.parseSourceId?.(sourceId);
      for (const record of this.forwardingBridge?.forwarded?.values?.() || []) {
        if (record.sourceId !== sourceId) continue;
        this.signaling.sendDirect(record.childPeerId, {
          type: 'RELAY_TRACK_STOP',
          senderId: this.userId,
          relayId: this.userId,
          publisherId: source?.publisherId || identity?.publisherId,
          sourceType: source?.type || type || identity?.type
        });
      }
      this.forwardingBridge?.stopAllForSource?.(sourceId);
    });

    this.participants = new Map(); // userId -> { userId, userName, stream, screenStream, screenAudioStream }
    this.listeners = new Map();

    if (onPeerJoin) this.on('peerJoined', ({ userId, userName }) => onPeerJoin(userId, userName));
    if (onPeerLeave) this.on('peerLeft', ({ userId }) => onPeerLeave(userId));
    if (onStream) this.on('participantStream', ({ peerId, stream }) => onStream(peerId, stream));
    if (onScreenStream) this.on('participantScreenStream', ({ peerId, stream }) => onScreenStream(peerId, stream));
    if (onScreenAudioStream) this.on('participantScreenAudioStream', ({ peerId, stream, track }) => onScreenAudioStream(peerId, stream, track));
    if (onData) {
      this.on('dataMessage', ({ data, peerId }) => onData(data, peerId));
      this.signaling.on('data', (data) => onData(data, null));
      this.signaling.on('peer-direct', (data) => onData(data, null));
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
      this.reconcileRelayMesh();
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
          this.failureDetector.recordHeartbeat(senderId);
          const answerDesc = await this.rtc.handleOffer(senderId, offer);
          if (answerDesc) {
            this.signaling.sendSignal(senderId, { type: 'answer', answer: answerDesc });
          }
        } else if (type === 'answer' && answer) {
          this.failureDetector.recordHeartbeat(senderId);
          await this.rtc.handleAnswer(senderId, answer);
        } else if (type === 'candidate' && candidate) {
          await this.rtc.handleCandidate(senderId, candidate);
        }
      } catch (err) {
        console.warn(`[MeetingController] Error handling signal from ${senderId}:`, err);
      }
      this.reconcileRelayMesh();
    });

    this.signaling.on('peer-left', ({ userId }) => {
      this.failureDetector.removePeer(userId);
      this.topology?.removePeer?.(userId);
      this.keyManager?.handlePeerLeave?.(userId);
      this.rtc.removePeer(userId);
      this.trackManager?.unregisterPeerSources?.(userId);
      this.participants.delete(userId);
      this.forwardingBridge?.stopAllForPeer?.(userId);
      this.emit('participantsChanged', this.getParticipants());
      this.emit('peerLeft', { userId });
      this.reconcileRelayMesh();
    });

    this.signaling.on('data', (data) => this.handleRelayControlMessage(data));
    this.signaling.on('peer-direct', (data) => this.handleRelayControlMessage(data));
  }

  setupRtcBridges() {
    this.rtc.on('iceCandidate', ({ peerId, candidate }) => {
      this.signaling.sendSignal(peerId, { type: 'candidate', candidate });
    });

    this.rtc.on('signal', ({ peerId, msg }) => {
      this.signaling.sendSignal(peerId, msg);
    });

    this.rtc.on('connectionStateChange', ({ peerId, state }) => {
      this.failureDetector.reportConnectionState(peerId, state);
      if (state === 'connected') this.forwardRelaySourcesToChildren();
    });

    this.rtc.on('track', ({ peerId, track, stream, sourceType, isForwarded }) => {
      if (track) {
        const source = this.trackManager?.registerRemoteTrack?.({ peerId, track, stream, isScreen: false });
        if (source) this.forwardRelaySource(source);
      } else if (isForwarded && sourceType) {
        this.trackManager?.unregisterRemoteSource?.(`${peerId}:${sourceType}`);
      }
      const participant = this.participants.get(peerId);
      if (participant) {
        participant.stream = stream;
        this.emit('participantStream', { peerId, stream, track });
        this.emit('participantsChanged', this.getParticipants());
      }
    });

    this.rtc.on('screenTrack', ({ peerId, track, stream }) => {
      if (track) {
        const source = this.trackManager?.registerRemoteTrack?.({ peerId, track, stream, isScreen: true });
        if (source) this.forwardRelaySource(source);
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

    this.rtc.on('screenAudioTrack', ({ peerId, track, stream }) => {
      if (track) {
        const source = this.trackManager?.registerRemoteTrack?.({ peerId, track, stream, isScreen: true, type: 'screenAudio' });
        if (source) this.forwardRelaySource(source);
      } else this.trackManager?.unregisterRemoteSource?.(`${peerId}:screenAudio`);
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

    this.rtc.on('peerRemoved', ({ peerId }) => {
      this.dataChannels.detachChannel(peerId);
      this.forwardingBridge?.stopAllForPeer?.(peerId);
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
    this.signaling.on('connected', () => {
      this.emit('connected');
      this.startRelayCoordination();
    });
    this.signaling.on('disconnected', () => this.emit('disconnected'));
    this.signaling.connect();
    this.quality.start();
    this.failureDetector.start();
    return true;
  }

  leave() {
    if (this.relayHeartbeatTimer) clearInterval(this.relayHeartbeatTimer);
    this.relayHeartbeatTimer = null;
    this.quality?.stop?.();
    this.failureDetector?.destroy?.();
    this.signaling.disconnect();
    this.rtc.destroy();
    this.media.stop();
    this.cleanupAudioMixer();
    this.forwardingBridge?.destroy?.();
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

  sendDataToPeer(peerId, payload) {
    return this.rtc.sendDataToPeer?.(peerId, payload) || false;
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

      await this.rtc.replaceTracks?.({ audioTrack, videoTrack, screenTrack, screenAudioTrack });
      this.trackManager.syncLocalTracks?.({ localStream: newStream.localStream, screenStream: newStream.screenStream });
      this.forwardRelaySourcesToChildren();
      return;
    }

    // Legacy plain-stream path
    const videoTrack = newStream?.getVideoTracks?.()[0] || null;
    const audioTrack = fallbackAudioStream?.getAudioTracks?.()[0] || newStream?.getAudioTracks?.()[0] || null;
    const screenTrack = isScreenSharing ? videoTrack : null;
    await this.rtc.replaceTracks?.({ audioTrack, videoTrack, screenTrack, isScreenSharing });
    this.trackManager.syncLocalTracks?.({ localStream: isScreenSharing ? null : newStream, screenStream: isScreenSharing ? newStream : null });
    this.forwardRelaySourcesToChildren();
  }

  setPeerScreenTrack(peerId, screenTrackId) {
    this.rtc?.setPeerScreenTrack?.(peerId, screenTrackId);
  }

  handleForwardInstruction({ sourceId, targetPeerId }) {
    if (!sourceId || !targetPeerId) return null;
    return this.forwardingBridge?.forwardTrack?.(sourceId, targetPeerId);
  }

  async collectRelayCapacity() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const ua = nav.userAgent || '';
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const cores = Number(nav.hardwareConcurrency) || 4;
    let measuredUploadBps = 0;
    let avgRttMs = Infinity;
    const samples = [];

    for (const peer of this.rtc?.peers?.values?.() || []) {
      try {
        const stats = await peer.pc.getStats();
        stats.forEach((stat) => {
          if (stat.type === 'candidate-pair' && (stat.state === 'succeeded' || stat.nominated)) {
            if (Number.isFinite(stat.availableOutgoingBitrate) && stat.availableOutgoingBitrate > 0) samples.push(stat.availableOutgoingBitrate);
            if (Number.isFinite(stat.currentRoundTripTime) && stat.currentRoundTripTime > 0) avgRttMs = Math.min(avgRttMs, stat.currentRoundTripTime * 1000);
          }
        });
      } catch (_) {}
    }
    if (samples.length) measuredUploadBps = Math.min(...samples);

    return {
      deviceType: mobile ? 'mobile' : (cores >= 8 ? 'desktop' : 'laptop'),
      isCharging: true,
      batteryLevel: 1,
      cpuLoad: cores >= 8 ? 0.25 : cores >= 4 ? 0.45 : 0.7,
      measuredUploadBps: measuredUploadBps || (mobile ? 1_000_000 : 5_000_000),
      avgRttMs: Number.isFinite(avgRttMs) ? avgRttMs : 45,
      packetLossPercent: 0,
      currentAssignedRelays: 0
    };
  }

  async publishRelayHeartbeat() {
    const capacity = await this.collectRelayCapacity();
    this.topology.handleRelayHeartbeat(this.userId, capacity);
    this.signaling.broadcast({ type: 'RELAY_HEARTBEAT', userId: this.userId, capacity });
    this.reconcileRelayMesh();
  }

  startRelayCoordination() {
    if (this.relayHeartbeatTimer) return;
    this.publishRelayHeartbeat();
    this.relayHeartbeatTimer = setInterval(() => this.publishRelayHeartbeat(), 4000);
  }

  handleRelayControlMessage(data) {
    if (!data || data.senderId === this.userId) return;
    if (data.type === 'RELAY_HEARTBEAT' && data.capacity) {
      const peerId = data.userId || data.senderId;
      if (!peerId || peerId === this.userId) return;
      this.topology.evaluatePeer({ id: peerId, name: data.userName || peerId });
      this.topology.handleRelayHeartbeat(peerId, data.capacity);
      this.reconcileRelayMesh();
    } else if (data.type === 'RELAY_TRACK_META' && data.relayId && data.streamId) {
      this.rtc.setRemoteStreamMetadata?.(data.relayId, data.streamId, data);
    } else if (data.type === 'RELAY_TRACK_STOP' && data.relayId && data.publisherId && data.sourceType) {
      this.rtc.removeForwardedTrack?.(data.relayId, data.publisherId, data.sourceType);
    }
  }

  shouldSendDirectMedia(peerId) {
    if (this.topology?.getMode?.() === 'mesh' || !this.relayPeerIds?.length) return true;
    if (this.relayPeerIds.includes(peerId)) return true;
    if (this.relayPeerIds.includes(this.userId)) {
      return (this.relayChildren.get(this.userId) || []).includes(peerId);
    }
    return this.relayDirectFallbackIds.includes(this.userId) || this.relayDirectFallbackIds.includes(peerId);
  }

  async ensureRelayConnection(peerId) {
    if (!peerId || peerId === this.userId) return;
    if (this.rtc.getPeer(peerId)) return;
    const shouldInitiate = String(this.userId).localeCompare(String(peerId)) < 0;
    this.rtc.createPeer(peerId, shouldInitiate);
    if (!shouldInitiate) return;
    try {
      const offer = await this.rtc.createOffer(peerId);
      this.signaling.sendSignal(peerId, { type: 'offer', offer });
    } catch (error) {
      console.warn(`[MeetingController] Could not connect to elected relay ${peerId}:`, error);
    }
  }

  reconcileRelayMesh() {
    const activeIds = Array.from(this.topology.activePeers.keys());
    if (activeIds.length + 1 <= 8) {
      this.relayPeerIds = [];
      this.relayDirectFallbackIds = [];
      this.relayChildren.forEach((children) => children.forEach((childId) => this.forwardingBridge.stopAllForPeer(childId)));
      this.relayChildren.clear();
      for (const peerId of this.rtc.peers.keys()) {
        this.rtc.setPeerExpectedRelay?.(peerId, false);
        this.rtc.setPeerMediaEnabled?.(peerId, true);
      }
      return;
    }
    const relayIds = this.topology.getRelayIds(2);
    if (!relayIds.length) {
      this.relayChildren.forEach((children) => children.forEach((childId) => this.forwardingBridge.stopAllForPeer(childId)));
      this.relayChildren.clear();
      this.relayPeerIds = [];
      this.relayDirectFallbackIds = [];
      for (const peerId of this.rtc.peers.keys()) {
        this.rtc.setPeerExpectedRelay?.(peerId, false);
        this.rtc.setPeerMediaEnabled?.(peerId, true);
      }
      return;
    }
    const previousChildren = this.relayChildren.get(this.userId) || [];
    this.relayPeerIds = relayIds;
    const peers = [...activeIds, this.userId];
    const assignments = this.topology.getRelaySubscribers(relayIds, peers);
    this.relayDirectFallbackIds = this.topology.getDirectFallbackPeers(relayIds, assignments, peers);
    this.relayChildren = assignments;

    const nextChildren = new Set(assignments.get(this.userId) || []);
    for (const childId of previousChildren) {
      if (!nextChildren.has(childId)) this.forwardingBridge.stopAllForPeer(childId);
    }

    // Keep full-mesh data channels for chat/files/control. Send media upstream
    // to elected relays only; each relay forwards to its deterministic audience.
    for (const peerId of this.rtc.peers.keys()) {
      this.rtc.setPeerMediaEnabled?.(peerId, this.shouldSendDirectMedia(peerId));
    }
    for (const peerId of this.rtc.peers.keys()) {
      this.rtc.setPeerExpectedRelay?.(peerId, relayIds.includes(peerId));
    }
    for (const relayId of relayIds) {
      this.ensureRelayConnection(relayId);
      this.rtc.setPeerExpectedRelay?.(relayId, true);
    }
    if (relayIds.includes(this.userId)) this.forwardRelaySourcesToChildren();
  }

  forwardRelaySource(source) {
    if (!source || !this.relayPeerIds.includes(this.userId)) return;
    const children = this.relayChildren.get(this.userId) || [];
    for (const childPeerId of children) {
      if (childPeerId === source.publisherId) continue;
      this.forwardSourceToChild(source.sourceId, childPeerId);
    }
  }

  forwardRelaySourcesToChildren() {
    if (!this.relayPeerIds.includes(this.userId)) return;
    for (const source of this.trackManager?.getAllSources?.() || []) this.forwardRelaySource(source);
  }

  async forwardSourceToChild(sourceId, childPeerId) {
    const source = this.trackManager?.getSource(sourceId);
    if (!source?.track || !childPeerId || childPeerId === source.publisherId) return null;
    if (this.forwardingBridge?.forwarded?.has?.(`${sourceId}->${childPeerId}`)) {
      return this.forwardingBridge.forwarded.get(`${sourceId}->${childPeerId}`);
    }
    const record = await this.forwardingBridge?.forwardTrack?.(sourceId, childPeerId);
    if (!record) return null;
    // WebRTC assigns a different receiver track ID at each hop. The stream ID
    // survives forwarding, so use it to associate the incoming track with its
    // original publisher even when MQTT metadata arrives after ontrack.
    this.signaling.sendDirect(childPeerId, {
      type: 'RELAY_TRACK_META',
      senderId: this.userId,
      relayId: this.userId,
      streamId: record.streamId,
      publisherId: source.publisherId,
      sourceType: source.type
    });
    return record;
  }

  destroy() {
    this.leave();
  }
}
