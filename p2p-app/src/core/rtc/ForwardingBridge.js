/*
 * OpenMeet Client Core - ForwardingBridge
 * Binds incoming remote MediaStreamTracks to downstream child RTCPeerConnections for browser relaying.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class ForwardingBridge {
  constructor({ trackManager = null, rtc = null } = {}) {
    this.trackManager = trackManager;
    this.rtc = rtc;

    // key: `${sourceId}->${childPeerId}` -> { sourceId, childPeerId, sender, track }
    this.forwarded = new Map();
    this.relayStreams = new Map(); // sourceId -> MediaStream
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch (_) {}
    });
  }

  /**
   * Forward a media source track to a child peer connection.
   */
  async forwardTrack(sourceId, childPeerId) {
    const key = `${sourceId}->${childPeerId}`;
    if (this.forwarded.has(key)) return this.forwarded.get(key);

    const source = this.trackManager?.getSource(sourceId);
    if (!source || !source.track) {
      console.warn(`[ForwardingBridge] Source ${sourceId} track not found for forwarding`);
      return null;
    }

    const peer = this.rtc?.getPeer(childPeerId);
    if (!peer || !peer.pc) {
      console.warn(`[ForwardingBridge] Child peer ${childPeerId} connection not ready`);
      return null;
    }

    // Wrap in a stable relay MediaStream if in browser
    let stream = this.relayStreams.get(sourceId);
    if (!stream && typeof MediaStream !== 'undefined') {
      stream = new MediaStream();
      this.relayStreams.set(sourceId, stream);
    }
    if (stream && !stream.getTracks().includes(source.track)) {
      stream.addTrack(source.track);
    }

    let sender = null;
    try {
      if (typeof peer.pc.addTrack === 'function') {
        sender = peer.pc.addTrack(source.track, ...(stream ? [stream] : []));
      }
    } catch (e) {
      console.warn(`[ForwardingBridge] addTrack error forwarding to ${childPeerId}:`, e);
    }

    const record = {
      sourceId,
      childPeerId,
      track: source.track,
      sender,
      forwardedAt: Date.now()
    };

    this.forwarded.set(key, record);
    this.emit('trackForwarded', record);
    return record;
  }

  /**
   * Stop forwarding a source track to a specific child peer connection.
   */
  async stopForwarding(sourceId, childPeerId) {
    const key = `${sourceId}->${childPeerId}`;
    const record = this.forwarded.get(key);
    if (!record) return false;

    const peer = this.rtc?.getPeer(childPeerId);
    if (peer && peer.pc && record.sender) {
      try {
        if (typeof record.sender.replaceTrack === 'function') {
          await record.sender.replaceTrack(null);
        } else if (typeof peer.pc.removeTrack === 'function') {
          peer.pc.removeTrack(record.sender);
        }
      } catch (e) {
        console.warn(`[ForwardingBridge] Error removing forwarded track to ${childPeerId}:`, e);
      }
    }

    this.forwarded.delete(key);
    this.emit('trackForwardStopped', { sourceId, childPeerId });
    return true;
  }

  stopAllForSource(sourceId) {
    for (const [key, record] of this.forwarded.entries()) {
      if (record.sourceId === sourceId) {
        this.stopForwarding(record.sourceId, record.childPeerId);
      }
    }
    this.relayStreams.delete(sourceId);
  }

  stopAllForPeer(childPeerId) {
    for (const [key, record] of this.forwarded.entries()) {
      if (record.childPeerId === childPeerId) {
        this.stopForwarding(record.sourceId, record.childPeerId);
      }
    }
  }

  getForwardedList() {
    return Array.from(this.forwarded.values());
  }

  destroy() {
    for (const [key, record] of this.forwarded.entries()) {
      this.stopForwarding(record.sourceId, record.childPeerId);
    }
    this.forwarded.clear();
    this.relayStreams.clear();
    this.listeners.clear();
  }
}
