/*
 * OpenMeet Client Core - QualityController
 * Dynamic WebRTC runtime telemetry, RTT/loss tracking, and adaptive quality scaling.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class QualityController {
  constructor({ getPeers = () => [], intervalMs = 3000 } = {}) {
    this.getPeers = getPeers;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.listeners = new Map();
    this.lastStats = null;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(fn => {
      try { fn(data); } catch (_) {}
    });
  }

  async sample() {
    const peers = this.getPeers() || [];
    let totalRtt = 0;
    let rttSamples = 0;
    let packetsLost = 0;
    let packetsTotal = 0;
    let connectedPeers = 0;

    for (const peer of peers) {
      const pc = peer.pc || peer;
      if (!pc || pc.connectionState !== 'connected' || typeof pc.getStats !== 'function') continue;
      connectedPeers++;

      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime !== undefined) {
            totalRtt += report.currentRoundTripTime * 1000;
            rttSamples++;
          }
          if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
            if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
              packetsLost += report.packetsLost;
              packetsTotal += (report.packetsReceived + report.packetsLost);
            }
            if (report.roundTripTime !== undefined) {
              totalRtt += report.roundTripTime * 1000;
              rttSamples++;
            }
          }
        });
      } catch (_) {}
    }

    const avgRtt = rttSamples > 0 ? Math.round(totalRtt / rttSamples) : 35;
    const lossRate = packetsTotal > 0 ? Math.round((packetsLost / packetsTotal) * 1000) / 10 : 0.0;

    let quality = 'excellent';
    let scaleFactor = 1.0;

    if (avgRtt > 300 || lossRate > 5.0) {
      quality = 'poor';
      scaleFactor = 2.0;
    } else if (avgRtt > 150 || lossRate > 2.0) {
      quality = 'fair';
      scaleFactor = 1.35;
    } else if (avgRtt > 80) {
      quality = 'good';
      scaleFactor = 1.15;
    }

    const projection = {
      rtt: avgRtt,
      lossRate,
      quality,
      scaleFactor,
      activePeers: connectedPeers,
      timestamp: Date.now()
    };

    this.lastStats = projection;
    this.emit('stats', projection);
    return projection;
  }

  start() {
    if (this.timer) return;
    this.sample();
    this.timer = setInterval(() => this.sample(), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.listeners.clear();
  }
}
