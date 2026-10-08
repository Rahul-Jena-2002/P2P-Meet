/*
 * OpenMeet Client Core - FailureDetector
 * Detects relay node heartbeats, silent stalls, and WebRTC connection failures.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class FailureDetector {
  constructor({
    heartbeatTimeoutMs = 3500,
    checkIntervalMs = 1500
  } = {}) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    this.checkIntervalMs = checkIntervalMs;

    this.peerHeartbeats = new Map(); // peerId -> timestamp
    this.timer = null;
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

  recordHeartbeat(peerId) {
    if (!peerId) return;
    this.peerHeartbeats.set(peerId, Date.now());
  }

  reportConnectionState(peerId, state) {
    if (state === 'failed' || state === 'closed' || state === 'disconnected') {
      this.emit('nodeFailed', { peerId, reason: `connection-${state}` });
      this.peerHeartbeats.delete(peerId);
    }
  }

  reportHeartbeatTimeout(peerId) {
    this.emit('nodeFailed', { peerId, reason: 'heartbeat-timeout' });
    this.peerHeartbeats.delete(peerId);
  }

  checkHealth() {
    const now = Date.now();
    for (const [peerId, lastTime] of this.peerHeartbeats.entries()) {
      if (now - lastTime > this.heartbeatTimeoutMs) {
        this.emit('nodeFailed', { peerId, reason: 'heartbeat-timeout' });
        this.peerHeartbeats.delete(peerId);
      }
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkHealth(), this.checkIntervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  removePeer(peerId) {
    this.peerHeartbeats.delete(peerId);
  }

  destroy() {
    this.stop();
    this.peerHeartbeats.clear();
    this.listeners.clear();
  }
}
