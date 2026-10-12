/*
 * OpenMeet Client Core - TopologyManager
 * Orchestrates connection topologies: Full Mesh (N<=8), Hybrid (8<N<=30), and Relay Tree (N>30).
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { OverlayManager } from './OverlayManager.js';
import { RelaySelector } from './RelaySelector.js';
import { RelayCapacityEstimator } from './RelayCapacityEstimator.js';
import { HybridStrategy } from './HybridStrategy.js';
import { RelayTreeStrategy } from './RelayTreeStrategy.js';

export class MeshStrategy {
  constructor({ maxFullMeshPeers = 8 } = {}) {
    this.maxFullMeshPeers = maxFullMeshPeers;
  }

  shouldConnect(localUser, remotePeer, totalCount = 1) {
    if (totalCount <= this.maxFullMeshPeers) {
      return true;
    }
    // For larger rooms: Prioritize active publishers, screen sharers, and recent speakers
    return remotePeer.isPublishing || remotePeer.isScreenSharing;
  }
}

export class TopologyManager {
  constructor({
    localUserId,
    rtc = null,
    strategy = null
  } = {}) {
    this.localUserId = localUserId || 'local-user';
    this.rtc = rtc;

    this.activePeers = new Map(); // peerId -> peerState

    this.capacityEstimator = new RelayCapacityEstimator();
    this.relaySelector = new RelaySelector({ estimator: this.capacityEstimator });
    this.overlayManager = new OverlayManager({ localUserId: this.localUserId });

    this.meshStrategy = new MeshStrategy({ maxFullMeshPeers: 8 });
    this.hybridStrategy = new HybridStrategy({ maxDirectPeers: 8, relayThreshold: 8 });
    this.relayTreeStrategy = new RelayTreeStrategy({ relaySelector: this.relaySelector });

    this.strategy = strategy || this.meshStrategy;
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

  getMode() {
    const count = this.activePeers.size + 1;
    if (count <= 8) return 'mesh';
    if (count <= 30) return 'hybrid';
    return 'relay-tree';
  }

  updateAutoStrategy() {
    const mode = this.getMode();
    if (mode === 'mesh' && this.strategy !== this.meshStrategy) {
      this.strategy = this.meshStrategy;
      this.emit('modeChanged', { mode: 'mesh' });
    } else if (mode === 'hybrid' && this.strategy !== this.hybridStrategy) {
      this.strategy = this.hybridStrategy;
      this.emit('modeChanged', { mode: 'hybrid' });
    } else if (mode === 'relay-tree' && this.strategy !== this.relayTreeStrategy) {
      this.strategy = this.relayTreeStrategy;
      this.emit('modeChanged', { mode: 'relay-tree' });
    }
  }

  evaluatePeer(peerInfo) {
    if (!peerInfo || !peerInfo.id || peerInfo.id === this.localUserId) return;

    this.activePeers.set(peerInfo.id, peerInfo);
    this.updateAutoStrategy();

    const should = this.strategy.shouldConnect(
      { id: this.localUserId },
      peerInfo,
      this.activePeers.size + 1
    );

    if (should && typeof this.rtc?.createPeer === 'function') {
      this.rtc.createPeer(peerInfo.id);
    }
  }

  removePeer(peerId) {
    this.activePeers.delete(peerId);
    this.relaySelector.removePeer(peerId);
    this.overlayManager.removePeer(peerId);
    this.updateAutoStrategy();
  }

  setStrategy(newStrategy) {
    this.strategy = newStrategy;
  }

  // -------------------------------------------------------------
  // RELAY & OVERLAY APIS
  // -------------------------------------------------------------
  handleRelayHeartbeat(peerId, capacityData) {
    return this.relaySelector.updatePeerCapacity(peerId, capacityData);
  }

  getRelayIds(limit = 2) {
    const ids = this.relaySelector.selectTopRelays(limit, []);
    // Stable ordering gives every browser the same subscriber hash buckets.
    return ids.sort((a, b) => String(a).localeCompare(String(b)));
  }

  getRelaySubscribers(relayIds, peerIds = Array.from(this.activePeers.keys())) {
    const relays = [...new Set(relayIds || [])].sort((a, b) => String(a).localeCompare(String(b)));
    const subscribers = new Map(relays.map((id) => [id, []]));
    if (!relays.length) return subscribers;

    for (const peerId of [...new Set(peerIds)].sort((a, b) => String(a).localeCompare(String(b)))) {
      if (!peerId || relays.includes(peerId)) continue;
      const hash = Array.from(String(peerId)).reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
      const startIndex = hash % relays.length;
      for (let offset = 0; offset < relays.length; offset += 1) {
        const relayId = relays[(startIndex + offset) % relays.length];
        const capacity = this.relaySelector.getPeerCapacity(relayId)?.evaluation?.availableFanout || 0;
        if ((subscribers.get(relayId)?.length || 0) < capacity) {
          subscribers.get(relayId).push(peerId);
          break;
        }
      }
    }
    return subscribers;
  }

  getDirectFallbackPeers(relayIds, relayAssignments, peerIds = Array.from(this.activePeers.keys())) {
    const relays = new Set(relayIds || []);
    const assigned = new Set();
    for (const children of relayAssignments?.values?.() || []) {
      for (const peerId of children) assigned.add(peerId);
    }
    return [...new Set(peerIds)].filter((peerId) => !relays.has(peerId) && !assigned.has(peerId));
  }

  handleRelayAssign(assignment) {
    return this.overlayManager.assignRelay(assignment);
  }

  handleRelayRemove(assignment) {
    return this.overlayManager.removeRelay(assignment);
  }

  buildSourceTreeRoutes(sourceId, publisherId, subscriberIds) {
    return this.relayTreeStrategy.buildTreeRoutes({
      sourceId,
      publisherId,
      subscriberIds,
      candidateRelayIds: Array.from(this.activePeers.keys())
    });
  }

  destroy() {
    this.activePeers.clear();
    this.relaySelector.clear();
    this.overlayManager.clear();
    this.listeners.clear();
  }
}
export { OverlayManager, RelaySelector, RelayCapacityEstimator, HybridStrategy, RelayTreeStrategy };
