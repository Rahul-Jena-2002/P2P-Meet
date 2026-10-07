/*
 * OpenMeet Client Core - Rebalancer
 * Incremental reparenting of orphan subtrees when a parent relay node disconnects or stalls.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class Rebalancer {
  constructor({
    overlayManager = null,
    relaySelector = null,
    localUserId = 'local-user'
  } = {}) {
    this.overlayManager = overlayManager;
    this.relaySelector = relaySelector;
    this.localUserId = localUserId;

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
   * Handle the detected failure of a relay peer.
   * Finds all sources where the failed peer was an upstream parent and migrates to a replacement.
   */
  handleNodeFailure(failedPeerId) {
    if (!failedPeerId || !this.overlayManager) return [];

    const migrations = [];
    const trees = this.overlayManager.getAllTrees();

    for (const tree of trees) {
      if (tree.upstreamParent === failedPeerId) {
        // Local node was receiving from failed parent: find new parent relay
        const newParentId = this.relaySelector?.selectRelayForSource({
          sourceId: tree.sourceId,
          publisherId: tree.publisherId,
          excludePeerIds: [failedPeerId, this.localUserId]
        }) || tree.publisherId; // Fallback to publisher directly

        this.overlayManager.assignRelay({
          sourceId: tree.sourceId,
          parentPeerId: newParentId,
          childPeerId: this.localUserId,
          generation: tree.generation + 1
        });

        const migration = {
          sourceId: tree.sourceId,
          oldParentId: failedPeerId,
          newParentId,
          childId: this.localUserId
        };
        migrations.push(migration);
        this.emit('reparentCompleted', migration);
      }
    }

    return migrations;
  }
}
