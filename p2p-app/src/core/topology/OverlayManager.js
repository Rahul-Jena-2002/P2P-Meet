/*
 * OpenMeet Client Core - OverlayManager
 * Manages per-source media distribution trees, parent relays, and child forwarding relationships.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class OverlayManager {
  constructor({ localUserId } = {}) {
    this.localUserId = localUserId || 'local-user';

    // sourceId -> { sourceId, publisherId, upstreamParent, downstreamChildren: Set<string>, subscribers: Set<string>, generation: number }
    this.trees = new Map();

    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.warn(`[OverlayManager] Error in ${event} listener:`, e);
      }
    });
  }

  registerSource(sourceId, publisherId) {
    if (!sourceId) return null;
    let tree = this.trees.get(sourceId);
    if (!tree) {
      tree = {
        sourceId,
        publisherId: publisherId || sourceId.split(':')[0],
        upstreamParent: publisherId === this.localUserId ? null : publisherId,
        downstreamChildren: new Set(),
        subscribers: new Set(),
        generation: 1
      };
      this.trees.set(sourceId, tree);
      this.emit('treeCreated', { sourceId, tree });
    }
    return tree;
  }

  unregisterSource(sourceId) {
    const tree = this.trees.get(sourceId);
    if (!tree) return false;

    // Notify any children that forwarding has stopped
    for (const childId of tree.downstreamChildren) {
      this.emit('forwardTrackStop', { sourceId, childPeerId: childId });
    }

    this.trees.delete(sourceId);
    this.emit('treeRemoved', { sourceId });
    return true;
  }

  assignRelay({ sourceId, parentPeerId, childPeerId, generation = 1 }) {
    let tree = this.trees.get(sourceId);
    if (!tree) {
      tree = this.registerSource(sourceId);
    }

    // 1. If local peer is the assigned parent, local peer must forward track to child
    if (parentPeerId === this.localUserId) {
      if (!tree.downstreamChildren.has(childPeerId)) {
        tree.downstreamChildren.add(childPeerId);
        this.emit('forwardTrackRequired', { sourceId, childPeerId });
      }
    }

    // 2. If local peer is the assigned child, local peer's upstream parent changes
    if (childPeerId === this.localUserId) {
      const oldParent = tree.upstreamParent;
      if (oldParent !== parentPeerId) {
        tree.upstreamParent = parentPeerId;
        this.emit('upstreamChanged', { sourceId, oldParent, newParent: parentPeerId });
      }
    }

    tree.subscribers.add(childPeerId);
    tree.generation = Math.max(tree.generation, generation);
    this.emit('treeUpdated', { sourceId, tree });
    return tree;
  }

  removeRelay({ sourceId, parentPeerId, childPeerId }) {
    const tree = this.trees.get(sourceId);
    if (!tree) return false;

    if (parentPeerId === this.localUserId) {
      if (tree.downstreamChildren.has(childPeerId)) {
        tree.downstreamChildren.delete(childPeerId);
        this.emit('forwardTrackStop', { sourceId, childPeerId });
      }
    }

    if (childPeerId === this.localUserId && tree.upstreamParent === parentPeerId) {
      tree.upstreamParent = null;
      this.emit('upstreamChanged', { sourceId, oldParent: parentPeerId, newParent: null });
    }

    tree.subscribers.delete(childPeerId);
    this.emit('treeUpdated', { sourceId, tree });
    return true;
  }

  getTree(sourceId) {
    return this.trees.get(sourceId) || null;
  }

  getAllTrees() {
    return Array.from(this.trees.values());
  }

  getForwardingChildren(sourceId) {
    return Array.from(this.trees.get(sourceId)?.downstreamChildren || []);
  }

  getUpstreamParent(sourceId) {
    return this.trees.get(sourceId)?.upstreamParent || null;
  }

  removePeer(peerId) {
    for (const [sourceId, tree] of this.trees.entries()) {
      if (tree.publisherId === peerId) {
        this.unregisterSource(sourceId);
      } else {
        if (tree.downstreamChildren.has(peerId)) {
          tree.downstreamChildren.delete(peerId);
          this.emit('forwardTrackStop', { sourceId, childPeerId: peerId });
        }
        if (tree.upstreamParent === peerId) {
          tree.upstreamParent = null;
          this.emit('upstreamChanged', { sourceId, oldParent: peerId, newParent: null });
        }
        tree.subscribers.delete(peerId);
      }
    }
  }

  clear() {
    this.trees.clear();
    this.listeners.clear();
  }
}
