/*
 * OpenMeet Client Core - TrackManager
 * Manages media track lifecycles, stable sourceId registry, and WebRTC transceiver attachments.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class TrackManager {
  constructor({ userId, rtc = null } = {}) {
    this.userId = userId || 'local-user';
    this.rtc = rtc;

    // sourceId -> SourceEntry
    // SourceEntry: { sourceId, publisherId, type: 'camera'|'screen'|'audio', track, stream, enabled, isLocal }
    this.localSources = new Map();
    this.remoteSources = new Map();

    this.listeners = new Map();
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
      set.forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.warn(`[TrackManager] Error in ${event} listener:`, e);
        }
      });
    }
  }

  // -------------------------------------------------------------
  // SOURCE IDENTITY HELPERS
  // -------------------------------------------------------------
  createSourceId(publisherId, type) {
    return `${publisherId}:${type}`;
  }

  parseSourceId(sourceId) {
    if (!sourceId || typeof sourceId !== 'string') return null;
    const parts = sourceId.split(':');
    if (parts.length < 2) return null;
    return {
      publisherId: parts.slice(0, -1).join(':'),
      type: parts[parts.length - 1]
    };
  }

  // -------------------------------------------------------------
  // LOCAL TRACK MANAGEMENT
  // -------------------------------------------------------------
  async setLocalAudioTrack(track) {
    const sourceId = this.createSourceId(this.userId, 'audio');
    if (!track) {
      this.localSources.delete(sourceId);
      if (this.rtc?.setLocalTrack) {
        await this.rtc.setLocalTrack('audio', null);
      }
      this.emit('sourceRemoved', { sourceId, type: 'audio', isLocal: true });
      this.emit('sourcesChanged', this.getAllSources());
      return null;
    }

    const source = {
      sourceId,
      publisherId: this.userId,
      type: 'audio',
      track,
      enabled: track.enabled !== false,
      isLocal: true,
      updatedAt: Date.now()
    };
    this.localSources.set(sourceId, source);

    if (this.rtc?.setLocalTrack) {
      await this.rtc.setLocalTrack('audio', track);
    }

    this.emit('sourceAdded', { sourceId, source, isLocal: true });
    this.emit('sourcesChanged', this.getAllSources());
    return source;
  }

  async setLocalCameraTrack(track) {
    const sourceId = this.createSourceId(this.userId, 'camera');
    if (!track) {
      this.localSources.delete(sourceId);
      if (this.rtc?.setLocalTrack) {
        await this.rtc.setLocalTrack('video', null);
      }
      this.emit('sourceRemoved', { sourceId, type: 'camera', isLocal: true });
      this.emit('sourcesChanged', this.getAllSources());
      return null;
    }

    try {
      track.contentHint = 'motion';
    } catch (_) {}

    const source = {
      sourceId,
      publisherId: this.userId,
      type: 'camera',
      track,
      enabled: track.enabled !== false,
      isLocal: true,
      updatedAt: Date.now()
    };
    this.localSources.set(sourceId, source);

    if (this.rtc?.setLocalTrack) {
      await this.rtc.setLocalTrack('video', track);
    }

    this.emit('sourceAdded', { sourceId, source, isLocal: true });
    this.emit('sourcesChanged', this.getAllSources());
    return source;
  }

  async setLocalScreenTrack(track) {
    const sourceId = this.createSourceId(this.userId, 'screen');
    if (!track) {
      this.localSources.delete(sourceId);
      if (this.rtc?.setLocalTrack) {
        await this.rtc.setLocalTrack('screen', null);
      }
      this.emit('sourceRemoved', { sourceId, type: 'screen', isLocal: true });
      this.emit('sourcesChanged', this.getAllSources());
      return null;
    }

    try {
      track.contentHint = 'detail';
    } catch (_) {}

    const onEndedHandler = async () => {
      if (typeof track.removeEventListener === 'function') {
        track.removeEventListener('ended', onEndedHandler);
      }
      await this.setLocalScreenTrack(null);
      this.emit('screenEnded', { sourceId });
    };
    if (typeof track.addEventListener === 'function') {
      track.addEventListener('ended', onEndedHandler);
    }

    const source = {
      sourceId,
      publisherId: this.userId,
      type: 'screen',
      track,
      enabled: track.enabled !== false,
      isLocal: true,
      updatedAt: Date.now()
    };
    this.localSources.set(sourceId, source);

    if (this.rtc?.setLocalTrack) {
      await this.rtc.setLocalTrack('screen', track);
    }

    this.emit('sourceAdded', { sourceId, source, isLocal: true });
    this.emit('sourcesChanged', this.getAllSources());
    return source;
  }

  async updateFromStreams({ localStream = null, screenStream = null } = {}) {
    const audioTrack = localStream?.getAudioTracks?.()[0] || null;
    const videoTrack = localStream?.getVideoTracks?.()[0] || null;
    const screenTrack = screenStream?.getVideoTracks?.()[0] || null;

    await this.setLocalAudioTrack(audioTrack);
    await this.setLocalCameraTrack(videoTrack);
    await this.setLocalScreenTrack(screenTrack);
  }

  // -------------------------------------------------------------
  // REMOTE TRACK MANAGEMENT
  // -------------------------------------------------------------
  registerRemoteTrack({ peerId, track, stream = null, isScreen = false }) {
    if (!peerId || !track) return null;

    let type = 'camera';
    if (isScreen) {
      type = 'screen';
    } else if (track.kind === 'audio') {
      type = 'audio';
    }

    const sourceId = this.createSourceId(peerId, type);

    const onEndedHandler = () => {
      if (typeof track.removeEventListener === 'function') {
        track.removeEventListener('ended', onEndedHandler);
      }
      this.unregisterRemoteSource(sourceId);
    };
    if (typeof track.addEventListener === 'function') {
      track.addEventListener('ended', onEndedHandler);
    }

    const source = {
      sourceId,
      publisherId: peerId,
      type,
      track,
      stream,
      enabled: track.enabled !== false,
      isLocal: false,
      updatedAt: Date.now()
    };

    this.remoteSources.set(sourceId, source);
    this.emit('sourceAdded', { sourceId, source, isLocal: false });
    this.emit('sourcesChanged', this.getAllSources());
    return source;
  }

  unregisterRemoteSource(sourceId) {
    const existing = this.remoteSources.get(sourceId);
    if (!existing) return false;

    this.remoteSources.delete(sourceId);
    this.emit('sourceRemoved', {
      sourceId,
      type: existing.type,
      publisherId: existing.publisherId,
      isLocal: false
    });
    this.emit('sourcesChanged', this.getAllSources());
    return true;
  }

  unregisterPeerSources(peerId) {
    if (!peerId) return;
    const toRemove = [];
    for (const [sourceId, source] of this.remoteSources.entries()) {
      if (source.publisherId === peerId) {
        toRemove.push(sourceId);
      }
    }
    toRemove.forEach((sid) => this.unregisterRemoteSource(sid));
  }

  // -------------------------------------------------------------
  // QUERY APIS
  // -------------------------------------------------------------
  getSource(sourceId) {
    return this.localSources.get(sourceId) || this.remoteSources.get(sourceId) || null;
  }

  getAllSources() {
    return [...this.localSources.values(), ...this.remoteSources.values()];
  }

  getLocalSources() {
    return [...this.localSources.values()];
  }

  getRemoteSources() {
    return [...this.remoteSources.values()];
  }

  getSourcesByPeer(peerId) {
    if (peerId === this.userId) return this.getLocalSources();
    return [...this.remoteSources.values()].filter((s) => s.publisherId === peerId);
  }

  destroy() {
    this.localSources.clear();
    this.remoteSources.clear();
    this.listeners.clear();
  }
}
