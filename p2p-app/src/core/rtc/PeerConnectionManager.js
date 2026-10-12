/*
 * OpenMeet Client Core - PeerConnectionManager
 * Robust WebRTC mesh manager with track transceiver management and ICE candidate buffering.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export const DEFAULT_RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 2,
};

export class PeerConnectionManager {
  constructor(options = {}) {
    this.myId = options.myId || null;
    this.rtcConfig = options.rtcConfig || DEFAULT_RTC_CONFIG;
    this.peerConnectionFactory = options.peerConnectionFactory || ((cfg) => {
      if (typeof window !== 'undefined' && window.RTCPeerConnection) {
        return new window.RTCPeerConnection(cfg);
      }
      throw new Error('RTCPeerConnection not supported in this runtime');
    });

    this.peers = new Map(); // peerId -> { pc, polite, makingOffer, ignoreOffer, isSettingRemoteAnswerPending, senders, ... }
    this.listeners = new Map();
    this.local = { audio: null, video: null, screen: null, screenAudio: null }; // slots: mic, camera, screen, screenAudio
    this.localStream = null; // camera stream (audio + camera video)
    this.localScreenStream = null; // screen stream
    this.senderTransformFactory = options.senderTransformFactory || null;
    this.receiverTransformFactory = options.receiverTransformFactory || null;
    this.peerMediaPolicy = options.peerMediaPolicy || null;
    this.natClassifier = options.natClassifier || null;
    this.natType = 'unknown';
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
        try { fn(data); } catch (e) { console.warn(`[PeerConnection] Error in ${event} listener:`, e); }
      });
    }
  }

  getPeer(peerId) {
    return this.peers.get(peerId);
  }

  async classifyNat() {
    if (this.natClassifier) {
      const res = await this.natClassifier.classify();
      this.natType = res.natType;
      return res;
    }
    return { natType: this.natType };
  }

  createPeer(peerId, isInitiator = false, isPolite = undefined, options = {}) {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    const pc = this.peerConnectionFactory(this.rtcConfig);
    const polite = isPolite !== undefined ? isPolite : (this.myId ? this.myId < peerId : !isInitiator);

    const peerEntry = {
      peerId,
      pc,
      polite,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      remoteStream: typeof window !== 'undefined' && window.MediaStream ? new window.MediaStream() : null,
      remoteScreenStream: typeof window !== 'undefined' && window.MediaStream ? new window.MediaStream() : null,
      pendingCandidates: [],
      dataChannel: null,
      mediaEnabled: options.mediaEnabled ?? this.peerMediaPolicy?.(peerId) ?? true,
      expectedRelay: false,
      senders: {}, // slot -> RTCRtpSender
      remoteTrackMetadata: new Map(),
      pendingRelayTracks: new Map(),
      forwardedTrackMetadata: new Map(),
      forwardedStreams: new Map()
    };

    // Attach existing local tracks to new connection
    if (peerEntry.mediaEnabled) {
      if (this.local.audio) this.attachTrack(peerEntry, this.local.audio, 'audio');
      if (this.local.video) this.attachTrack(peerEntry, this.local.video, 'video');
      if (this.local.screen) this.attachTrack(peerEntry, this.local.screen, 'screen');
      if (this.local.screenAudio) this.attachTrack(peerEntry, this.local.screenAudio, 'screenAudio');
    }

    // Renegotiate whenever tracks are added later (late mic/camera/screen share)
    pc.onnegotiationneeded = async () => {
      if (peerEntry.makingOffer || pc.signalingState !== 'stable') return;
      try {
        const offer = await this.createOffer(peerId);
        this.emit('signal', { peerId, msg: { type: 'offer', offer } });
      } catch (err) {
        console.warn(`[PeerConnection] renegotiation failed for ${peerId}:`, err);
      }
    };

    pc.onicecandidate = (event) => {
      if (event && event.candidate) {
        this.emit('iceCandidate', { peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      if (event.receiver) {
        this.applyTransformToReceiver(event.receiver, track?.kind);
      }
      const streamId = event.streams?.[0]?.id;
      const relayMetadata = streamId ? peerEntry.remoteTrackMetadata.get(streamId) : null;
      if (relayMetadata?.publisherId && relayMetadata?.sourceType) {
        this.routeForwardedTrack(peerEntry, relayMetadata, track);
        return;
      }
      if (peerEntry.expectedRelay && streamId) {
        const pending = peerEntry.pendingRelayTracks.get(streamId) || [];
        pending.push(event);
        peerEntry.pendingRelayTracks.set(streamId, pending);
        const timeout = setTimeout(() => {
          const stillPending = peerEntry.pendingRelayTracks.get(streamId);
          if (!stillPending) return;
          peerEntry.pendingRelayTracks.delete(streamId);
          stillPending.forEach((queuedEvent) => this.processIncomingTrack(peerEntry, queuedEvent));
        }, 1200);
        pending[pending.length - 1]._relayMetadataTimeout = timeout;
        return;
      }
      this.processIncomingTrack(peerEntry, event);
    };

    pc.onconnectionstatechange = () => {
      this.emit('connectionStateChange', { peerId, state: pc.connectionState });
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    if (isInitiator) {
      try {
        const dc = pc.createDataChannel('meet-chat');
        this.setupDataChannel(peerId, dc, peerEntry);
      } catch (e) {
        console.warn(`[PeerConnection] Failed to create data channel for ${peerId}:`, e);
      }
    } else {
      pc.ondatachannel = (event) => {
        if (event && event.channel) {
          this.setupDataChannel(peerId, event.channel, peerEntry);
        }
      };
    }

    this.peers.set(peerId, peerEntry);
    this.emit('peerCreated', { peerId, isInitiator });
    return peerEntry;
  }

  processIncomingTrack(peerEntry, event, relayMetadata = null) {
    const { peerId } = peerEntry;
    const track = event.track;
    if (relayMetadata?.publisherId && relayMetadata?.sourceType) {
      this.routeForwardedTrack(peerEntry, relayMetadata, track);
      return;
    }
      const stream = event.streams?.[0];
      const isExpectedScreen = !!(peerEntry.expectedScreenTrackId && track.id === peerEntry.expectedScreenTrackId);
      const isExpectedScreenAudio = !!(peerEntry.expectedScreenAudioTrackId && track.id === peerEntry.expectedScreenAudioTrackId);
      const isSecondVideo = track?.kind === 'video' && peerEntry.remoteStream?.getVideoTracks()?.length > 0 && peerEntry.remoteStream.getVideoTracks()[0].id !== track.id;
      const isSecondAudio = track?.kind === 'audio' && peerEntry.remoteStream?.getAudioTracks()?.length > 0 && peerEntry.remoteStream.getAudioTracks()[0].id !== track.id;
      const isScreenHint = track?.contentHint === 'detail';
      const isScreen = stream?.id?.includes('screen') || isExpectedScreen || isExpectedScreenAudio || isSecondVideo || isSecondAudio || isScreenHint;

      if (isScreen) {
        if (track.kind === 'audio') {
          peerEntry.screenAudioTrack = track;
          if (peerEntry.remoteScreenStream && !peerEntry.remoteScreenStream.getTracks().includes(track)) {
            peerEntry.remoteScreenStream.addTrack(track);
          }
          track.onended = () => {
            peerEntry.remoteScreenStream?.removeTrack?.(track);
            this.emit('screenAudioTrack', { peerId, track: null, stream: null });
          };
          this.emit('screenAudioTrack', { peerId, track, stream: peerEntry.remoteScreenStream || stream });
        } else {
          if (peerEntry.remoteScreenStream && !peerEntry.remoteScreenStream.getTracks().includes(track)) {
            peerEntry.remoteScreenStream.addTrack(track);
          }
          track.onended = () => {
            peerEntry.remoteScreenStream?.removeTrack?.(track);
            this.emit('screenTrack', { peerId, track: null, stream: null });
          };
          this.emit('screenTrack', { peerId, track, stream: peerEntry.remoteScreenStream || stream });
        }
      } else {
        if (peerEntry.remoteStream && !peerEntry.remoteStream.getTracks().includes(track)) {
          peerEntry.remoteStream.addTrack(track);
        }
        this.emit('track', { peerId, track, stream: event.streams?.[0] || peerEntry.remoteStream });
      }
  }

  setRemoteStreamMetadata(relayPeerId, streamId, metadata) {
    const peer = this.peers.get(relayPeerId);
    if (!peer || !streamId || !metadata?.publisherId || !metadata?.sourceType) return false;
    peer.remoteTrackMetadata.set(streamId, metadata);
    const pending = peer.pendingRelayTracks.get(streamId) || [];
    if (pending.length) {
      peer.pendingRelayTracks.delete(streamId);
      pending.forEach((event) => {
        clearTimeout(event._relayMetadataTimeout);
        this.processIncomingTrack(peer, event, metadata);
      });
    }
    return true;
  }

  setRemoteTrackMetadata(relayPeerId, streamId, metadata) {
    return this.setRemoteStreamMetadata(relayPeerId, streamId, metadata);
  }

  setPeerExpectedRelay(peerId, expected) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.expectedRelay = !!expected;
    if (!peer.expectedRelay) {
      for (const [streamId, events] of peer.pendingRelayTracks.entries()) {
        peer.pendingRelayTracks.delete(streamId);
        const metadata = peer.remoteTrackMetadata.get(streamId);
        events.forEach((event) => {
          clearTimeout(event._relayMetadataTimeout);
          this.processIncomingTrack(peer, event, metadata);
        });
      }
    }
  }

  removeForwardedTrack(relayPeerId, publisherId, sourceType) {
    const peer = this.peers.get(relayPeerId);
    if (!peer) return false;
    const isScreen = sourceType === 'screen' || sourceType === 'screenAudio';
    const streamKey = `${publisherId}:${isScreen ? 'screen' : 'camera'}`;
    const stream = peer.forwardedStreams.get(streamKey);
    if (!stream) return false;
    for (const track of stream.getTracks()) {
      const metadata = peer.forwardedTrackMetadata.get(track.id);
      if (metadata?.publisherId === publisherId && metadata?.sourceType === sourceType) {
        stream.removeTrack(track);
        peer.forwardedTrackMetadata.delete(track.id);
        try { track.stop(); } catch (_) {}
      }
    }
    for (const [streamId, metadata] of peer.remoteTrackMetadata.entries()) {
      if (metadata.publisherId === publisherId && metadata.sourceType === sourceType) peer.remoteTrackMetadata.delete(streamId);
    }
    if (!stream.getTracks().length) peer.forwardedStreams.delete(streamKey);

    const eventName = sourceType === 'screen'
      ? 'screenTrack'
      : sourceType === 'screenAudio'
        ? 'screenAudioTrack'
        : 'track';
    this.emit(eventName, {
      peerId: publisherId,
      relayPeerId,
      track: null,
      stream: eventName === 'track' && stream.getTracks().length ? stream : null,
      isForwarded: true,
      sourceType
    });
    return true;
  }

  async setPeerMediaEnabled(peerId, enabled) {
    const peer = this.peers.get(peerId);
    if (!peer || peer.mediaEnabled === enabled) return;
    peer.mediaEnabled = enabled;
    const slots = ['audio', 'video', 'screen', 'screenAudio'];
    for (const slot of slots) {
      const track = this.local[slot];
      let sender = peer.senders?.[slot];
      if (enabled && track) {
        if (sender) {
          try { await sender.replaceTrack(track); } catch (_) {}
        } else {
          sender = this.attachTrack(peer, track, slot);
        }
      } else if (!enabled && sender?.track) {
        try { await sender.replaceTrack(null); } catch (_) {}
      }
    }
  }

  routeForwardedTrack(peer, metadata, track) {
    const { publisherId, sourceType } = metadata;
    peer.forwardedTrackMetadata.set(track.id, metadata);
    const isScreen = sourceType === 'screen' || sourceType === 'screenAudio';
    const streamKey = `${publisherId}:${isScreen ? 'screen' : 'camera'}`;
    let stream = peer.forwardedStreams.get(streamKey);
    const MediaStreamClass = typeof window !== 'undefined' ? window.MediaStream : globalThis.MediaStream;
    if (!stream && MediaStreamClass) {
      stream = new MediaStreamClass();
      peer.forwardedStreams.set(streamKey, stream);
    }
    if (stream && !stream.getTracks().includes(track)) stream.addTrack(track);

    const eventName = sourceType === 'screen'
      ? 'screenTrack'
      : sourceType === 'screenAudio'
        ? 'screenAudioTrack'
        : 'track';
    const emitTrack = (ended = false) => {
      if (ended) stream?.removeTrack?.(track);
      this.emit(eventName, {
        peerId: publisherId,
        relayPeerId: peer.peerId,
        track: ended ? null : track,
        stream: ended ? (isScreen ? null : (stream?.getTracks?.().length ? stream : null)) : stream,
        isForwarded: true,
        sourceType
      });
    };
    track.addEventListener?.('ended', () => emitTrack(true), { once: true });
    emitTrack();
  }

  setupDataChannel(peerId, channel, peerEntry) {
    peerEntry.dataChannel = channel;
    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.emit('dataMessage', { peerId, data: parsed });
      } catch {
        this.emit('dataMessage', { peerId, data: event.data });
      }
    };
    channel.onopen = () => this.emit('dataChannelOpen', { peerId });
    channel.onclose = () => this.emit('dataChannelClose', { peerId });
  }

  async createOffer(peerId) {
    const peer = this.getPeer(peerId) || this.createPeer(peerId, true);
    try {
      peer.makingOffer = true;
      const offer = await peer.pc.createOffer();
      if (offer && offer.sdp) {
        offer.sdp = PeerConnectionManager.mungeSdpForHighFidelityAudio(offer.sdp);
      }
      await peer.pc.setLocalDescription(offer);
      return peer.pc.localDescription || offer;
    } finally {
      peer.makingOffer = false;
    }
  }

  async handleOffer(peerId, offer) {
    const peer = this.getPeer(peerId) || this.createPeer(peerId, false);
    const offerCollision = (offer.type === 'offer') &&
      (peer.makingOffer || peer.pc.signalingState !== 'stable');

    peer.ignoreOffer = !peer.polite && offerCollision;
    if (peer.ignoreOffer) {
      console.log(`[PeerConnection] Glare collision detected on impolite peer ${peerId}: ignoring remote offer.`);
      return null;
    }

    if (offerCollision && typeof peer.pc.setLocalDescription === 'function') {
      try {
        await peer.pc.setLocalDescription({ type: 'rollback' });
      } catch (_) {}
    }

    await peer.pc.setRemoteDescription(offer);
    await this.drainPendingCandidates(peer);
    const answer = await peer.pc.createAnswer();
    if (answer && answer.sdp) {
      answer.sdp = PeerConnectionManager.mungeSdpForHighFidelityAudio(answer.sdp);
    }
    await peer.pc.setLocalDescription(answer);
    return peer.pc.localDescription || answer;
  }

  async handleAnswer(peerId, answer) {
    const peer = this.getPeer(peerId);
    if (!peer) return;
    try {
      peer.isSettingRemoteAnswerPending = true;
      await peer.pc.setRemoteDescription(answer);
      await this.drainPendingCandidates(peer);
    } finally {
      peer.isSettingRemoteAnswerPending = false;
    }
  }

  async handleCandidate(peerId, candidate) {
    const peer = this.getPeer(peerId) || this.createPeer(peerId);
    if (peer.pc.remoteDescription) {
      await peer.pc.addIceCandidate(candidate);
    } else {
      peer.pendingCandidates.push(candidate);
    }
  }

  async drainPendingCandidates(peer) {
    while (peer.pendingCandidates.length > 0) {
      const cand = peer.pendingCandidates.shift();
      try {
        await peer.pc.addIceCandidate(cand);
      } catch (err) {
        console.warn(`[PeerConnection] Failed draining ICE candidate for ${peer.peerId}:`, err);
      }
    }
  }

  // Add track to one peer by slot ('audio' | 'video' | 'screen')
  attachTrack(peer, track, slot = track.kind) {
    if (peer.mediaEnabled === false) return null;
    const isScreen = slot === 'screen';
    let stream;
    if (isScreen) {
      if (!this.localScreenStream && typeof MediaStream !== 'undefined') this.localScreenStream = new MediaStream();
      stream = this.localScreenStream;
    } else {
      if (!this.localStream && typeof MediaStream !== 'undefined') this.localStream = new MediaStream();
      stream = this.localStream;
    }

    if (stream && !stream.getTracks().includes(track)) stream.addTrack(track);
    if (track && track.kind === 'video') {
      try { track.contentHint = 'motion'; } catch (_) {}
    }
    try {
      const sender = peer.pc.addTrack(track, ...(stream ? [stream] : []));
      if (!peer.senders) peer.senders = {};
      peer.senders[slot] = sender;
      this.applyTransformToSender(sender, slot);
      return sender;
    } catch (err) {
      console.warn(`[PeerConnection] addTrack failed on ${peer.peerId}:`, err);
    }
  }

  setTransformHooks({ senderTransformFactory, receiverTransformFactory } = {}) {
    if (senderTransformFactory !== undefined) this.senderTransformFactory = senderTransformFactory;
    if (receiverTransformFactory !== undefined) this.receiverTransformFactory = receiverTransformFactory;
  }

  applyTransformToSender(sender, slot) {
    if (!sender || !this.senderTransformFactory) return;
    try {
      const transform = this.senderTransformFactory(sender, slot);
      if (!transform) return;
      if ('transform' in sender) {
        sender.transform = transform;
      } else if (typeof sender.createEncodedStreams === 'function') {
        const { readable, writable } = sender.createEncodedStreams();
        readable.pipeThrough(transform).pipeTo(writable).catch(() => {});
      }
    } catch (e) {
      console.warn(`[PeerConnection] Failed applying sender transform for ${slot}:`, e);
    }
  }

  applyTransformToReceiver(receiver, kind) {
    if (!receiver || !this.receiverTransformFactory) return;
    try {
      const transform = this.receiverTransformFactory(receiver, kind);
      if (!transform) return;
      if ('transform' in receiver) {
        receiver.transform = transform;
      } else if (typeof receiver.createEncodedStreams === 'function') {
        const { readable, writable } = receiver.createEncodedStreams();
        readable.pipeThrough(transform).pipeTo(writable).catch(() => {});
      }
    } catch (e) {
      console.warn(`[PeerConnection] Failed applying receiver transform for ${kind}:`, e);
    }
  }

  // Sender for `kind`: live sender, or an emptied one (track === null) belonging to that kind's transceiver.
  findSender(pc, kind) {
    const senders = pc.getSenders?.() || [];
    const live = senders.find((s) => s.track?.kind === kind);
    if (live) return live;
    const tr = pc.getTransceivers?.() || [];
    return tr.find((t) => !t.sender?.track && t.receiver?.track?.kind === kind)?.sender;
  }

  async setLocalTrack(slot, track) {
    const old = this.local[slot];
    this.local[slot] = track;
    const isScreen = slot === 'screen' || slot === 'screenAudio';
    const activeStream = isScreen ? this.localScreenStream : this.localStream;
    if (old && old !== track) activeStream?.removeTrack?.(old);
    if (track && activeStream && !activeStream.getTracks().includes(track)) {
      activeStream.addTrack(track);
    }
    if (track && slot === 'screen') {
      try { track.contentHint = 'detail'; } catch (_) {}
    } else if (track && slot === 'video') {
      try { track.contentHint = 'motion'; } catch (_) {}
    }

    for (const peer of this.peers.values()) {
      if (!peer.senders) peer.senders = {};
      if (!peer.mediaEnabled) continue;
      let sender = peer.senders[slot];
      // Only fallback to findSender if slot sender wasn't recorded and it's NOT screen sharing
      // (Screen sharing video & screen audio must have dedicated transceivers/senders)
      if (!sender && slot !== 'screen' && slot !== 'screenAudio') {
        sender = this.findSender(peer.pc, slot === 'audio' ? 'audio' : 'video');
      }

      if (sender) {
        try {
          await sender.replaceTrack(track);
          if (track) peer.senders[slot] = sender;
          else delete peer.senders[slot];
        } catch (e) {
          console.warn(`[PeerConnection] Error replacing ${slot} track for ${peer.peerId}:`, e);
        }
      } else if (track) {
        this.attachTrack(peer, track, slot);
      }
    }
  }

  setPeerScreenTrack(peerId, screenTrackId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.expectedScreenTrackId = screenTrackId;

    if (screenTrackId && peer.remoteStream) {
      const matchTrack = peer.remoteStream.getVideoTracks().find(t => t.id === screenTrackId);
      if (matchTrack) {
        peer.remoteStream.removeTrack(matchTrack);
        if (peer.remoteScreenStream && !peer.remoteScreenStream.getTracks().includes(matchTrack)) {
          peer.remoteScreenStream.addTrack(matchTrack);
        }
        this.emit('screenTrack', { peerId, track: matchTrack, stream: peer.remoteScreenStream });
      }
    } else if (!screenTrackId && peer.remoteScreenStream) {
      peer.remoteScreenStream.getTracks().forEach(t => peer.remoteScreenStream.removeTrack(t));
      this.emit('screenTrack', { peerId, track: null, stream: null });
    }
  }

  setPeerScreenAudioTrack(peerId, screenAudioTrackOrId) {
    const peer = this.peers.get(peerId);
    let track = null;
    if (typeof screenAudioTrackOrId === 'object' && screenAudioTrackOrId !== null) {
      track = screenAudioTrackOrId;
    } else if (typeof screenAudioTrackOrId === 'string' && peer) {
      peer.expectedScreenAudioTrackId = screenAudioTrackOrId;
      if (peer.remoteStream) {
        track = peer.remoteStream.getAudioTracks().find(t => t.id === screenAudioTrackOrId) || null;
      }
    }

    if (peer && track) {
      peer.screenAudioTrack = track;
      if (peer.remoteScreenStream && !peer.remoteScreenStream.getTracks().includes(track)) {
        peer.remoteScreenStream.addTrack(track);
      }
    }

    this.emit('screenAudioTrack', { peerId, track, stream: peer?.remoteScreenStream || null });
  }

  addTrack(track) {
    return this.setLocalTrack(track.kind, track);
  }

  async replaceTracks(tracks = {}) {
    if ('audioTrack' in tracks) await this.setLocalTrack('audio', tracks.audioTrack);
    if ('videoTrack' in tracks) await this.setLocalTrack('video', tracks.videoTrack);
    if ('screenTrack' in tracks) await this.setLocalTrack('screen', tracks.screenTrack);
    if ('screenAudioTrack' in tracks) await this.setLocalTrack('screenAudio', tracks.screenAudioTrack);
  }

  sendData(data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.peers.forEach(({ dataChannel }) => {
      if (dataChannel && dataChannel.readyState === 'open') {
        try {
          dataChannel.send(payload);
        } catch (e) {
          console.warn('[PeerConnection] Failed to send on data channel:', e);
        }
      }
    });
  }

  sendDataToPeer(peerId, data) {
    const channel = this.peers.get(peerId)?.dataChannel;
    if (!channel || channel.readyState !== 'open') return false;
    try {
      channel.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn(`[PeerConnection] Failed to send data to ${peerId}:`, error);
      return false;
    }
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    for (const events of peer.pendingRelayTracks.values()) {
      events.forEach((event) => clearTimeout(event._relayMetadataTimeout));
    }
    peer.pendingRelayTracks.clear();

    try {
      if (peer.dataChannel) {
        peer.dataChannel.close?.();
      }
      peer.pc.close();
    } catch (_) {}

    this.peers.delete(peerId);
    this.emit('peerRemoved', { peerId });
  }

  destroy() {
    this.peers.forEach((_, peerId) => this.removePeer(peerId));
    this.peers.clear();
    this.local = { audio: null, video: null, screen: null };
    this.localStream = null;
    this.localScreenStream = null;
    this.listeners.clear();
  }

  static mungeSdpForHighFidelityAudio(sdp) {
    if (!sdp || typeof sdp !== 'string') return sdp;

    // Locate the Opus payload type (typically 111)
    const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000\/2/i);
    if (!opusMatch) return sdp;

    const pt = opusMatch[1];
    const fmtpRegex = new RegExp(`^a=fmtp:${pt}\\s+(.*)$`, 'm');
    const paramsToAdd = 'stereo=1;sprop-stereo=1;maxaveragebitrate=510000;cbr=1';

    if (fmtpRegex.test(sdp)) {
      return sdp.replace(fmtpRegex, (match, existingParams) => {
        let updated = existingParams.trim();
        if (!/stereo=1/.test(updated)) updated += ';stereo=1';
        if (!/sprop-stereo=1/.test(updated)) updated += ';sprop-stereo=1';
        if (!/maxaveragebitrate=/.test(updated)) updated += ';maxaveragebitrate=510000';
        if (!/cbr=1/.test(updated)) updated += ';cbr=1';
        return `a=fmtp:${pt} ${updated}`;
      });
    } else {
      const rtpmapRegex = new RegExp(`(a=rtpmap:${pt}\\s+opus\\/48000\\/2\\r?\\n)`, 'i');
      return sdp.replace(rtpmapRegex, `$1a=fmtp:${pt} ${paramsToAdd}\r\n`);
    }
  }
}
