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

    if (should && this.rtc) {
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
