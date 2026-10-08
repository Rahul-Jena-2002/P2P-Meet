/*
 * OpenMeet Client Core - RelaySelector
 * Selects optimal relay nodes based on capacity scores, latency, and fanout availability.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { RelayCapacityEstimator } from './RelayCapacityEstimator.js';

export class RelaySelector {
  constructor({ estimator = new RelayCapacityEstimator() } = {}) {
    this.estimator = estimator;
    this.nodes = new Map(); // peerId -> NodeRecord
  }

  updatePeerCapacity(peerId, capacityMetrics) {
    if (!peerId) return null;
    const evaluation = this.estimator.estimate(capacityMetrics);
    const record = {
      peerId,
      metrics: capacityMetrics,
      evaluation,
      updatedAt: Date.now()
    };
    this.nodes.set(peerId, record);
    return record;
  }

  getPeerCapacity(peerId) {
    return this.nodes.get(peerId) || null;
  }

  removePeer(peerId) {
    this.nodes.delete(peerId);
  }

  /**
   * Select the single best relay for a stream.
   * @param {Object} options
   * @param {string} options.sourceId - ID of the media source to relay
   * @param {string} options.publisherId - Original publisher peerId (cannot relay to self)
   * @param {Set<string>|Array<string>} [options.candidatePeerIds] - Optional candidate filter
   * @param {Set<string>|Array<string>} [options.excludePeerIds] - Peers to exclude (e.g. cycle prevention)
   */
  selectRelayForSource({
    sourceId,
    publisherId,
    candidatePeerIds = null,
    excludePeerIds = []
  } = {}) {
    const excludes = new Set(excludePeerIds);
    if (publisherId) excludes.add(publisherId);

    const candidates = [];
    for (const [peerId, record] of this.nodes.entries()) {
      if (excludes.has(peerId)) continue;
      if (candidatePeerIds && !candidatePeerIds.includes(peerId)) continue;
      if (!record.evaluation.isEligible || record.evaluation.availableFanout <= 0) continue;

      candidates.push(record);
    }

    if (candidates.length === 0) return null;

    // Sort by relay score descending; tie-break by available fanout
    candidates.sort((a, b) => {
      const diff = b.evaluation.relayScore - a.evaluation.relayScore;
      if (diff !== 0) return diff;
      return b.evaluation.availableFanout - a.evaluation.availableFanout;
    });

    return candidates[0].peerId;
  }

  /**
   * Select top N relays for level-1 fanout distribution from a publisher.
   */
  selectTopRelays(count = 3, excludePeerIds = []) {
    const excludes = new Set(excludePeerIds);
    const eligible = [];

    for (const [peerId, record] of this.nodes.entries()) {
      if (excludes.has(peerId)) continue;
      if (record.evaluation.isEligible && record.evaluation.availableFanout > 0) {
        eligible.push(record);
      }
    }

    eligible.sort((a, b) => b.evaluation.relayScore - a.evaluation.relayScore);
    return eligible.slice(0, count).map((r) => r.peerId);
  }

  /**
   * Deterministically elects a Head Relay and a Hot Standby per cluster.
   * Tie-breaking hierarchy:
   * 1. NAT Reachability (reachable > restricted)
   * 2. Available Upload Bandwidth (higher is better)
   * 3. CPU Load (lower is better)
   * 4. RTT Latency (lower is better)
   * 5. Peer ID (lexicographical)
   */
  electHeadAndStandby(peers = []) {
    if (!peers || peers.length === 0) {
      return { headRelayId: null, standbyRelayId: null };
    }

    const sorted = [...peers].sort((a, b) => {
      // 1. Reachability
      const reachA = a.reachability === 'reachable' ? 1 : 0;
      const reachB = b.reachability === 'reachable' ? 1 : 0;
      if (reachB !== reachA) return reachB - reachA;

      // 2. Upload bandwidth
      const upA = a.uploadMbps ?? a.upload ?? 0;
      const upB = b.uploadMbps ?? b.upload ?? 0;
      if (upB !== upA) return upB - upA;

      // 3. CPU Load (lower is better)
      const cpuA = a.cpuLoad ?? a.cpu ?? 1.0;
      const cpuB = b.cpuLoad ?? b.cpu ?? 1.0;
      if (cpuA !== cpuB) return cpuA - cpuB;

      // 4. RTT (lower is better)
      const rttA = a.rttMs ?? a.rtt ?? 999;
      const rttB = b.rttMs ?? b.rtt ?? 999;
      if (rttA !== rttB) return rttA - rttB;

      // 5. Lexicographical peerId
      return String(a.peerId).localeCompare(String(b.peerId));
    });

    return {
      headRelayId: sorted[0]?.peerId || null,
      standbyRelayId: sorted[1]?.peerId || null
    };
  }

  clear() {
    this.nodes.clear();
  }
}
