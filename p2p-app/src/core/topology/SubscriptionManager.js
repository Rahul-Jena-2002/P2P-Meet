/*
 * OpenMeet Client Core - SubscriptionManager
 * Priority-driven selective subscription manager with 9-card viewport and quality tiers.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class SubscriptionManager {
  constructor({
    localUserId = 'local-user',
    maxVisibleCards = 9
  } = {}) {
    this.localUserId = localUserId;
    this.maxVisibleCards = maxVisibleCards;

    this.pinnedSourceId = null;
    this.activeSpeakerId = null;

    // sourceId -> { sourceId, quality: 'stage'|'normal'|'thumbnail', priority: number, visible: boolean }
    this.activeSubscriptions = new Map();
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

  setPinnedSource(sourceId) {
    this.pinnedSourceId = sourceId;
    this.emit('pinChanged', { pinnedSourceId: sourceId });
  }

  setActiveSpeaker(userId) {
    this.activeSpeakerId = userId;
  }

  /**
   * Evaluates available room sources and recalculates selective subscriptions.
   * @param {Array<{ sourceId: string, publisherId: string, type: 'camera'|'screen'|'audio' }>} allSources
   * @param {number} [viewportOffset=0] - Offset for virtualized navigation/scrolling
   */
  evaluateSubscriptions(allSources = [], viewportOffset = 0) {
    // Exclude own local sources from remote subscription requirements
    const remoteSources = allSources.filter((s) => s.publisherId !== this.localUserId);

    // If pinned source disappeared, clear pin
    if (this.pinnedSourceId && !remoteSources.some((s) => s.sourceId === this.pinnedSourceId)) {
      this.pinnedSourceId = null;
      this.emit('pinChanged', { pinnedSourceId: null });
    }

    // Rank sources by priority
    const scoredSources = remoteSources.map((source) => {
      let priority = 10;
      let quality = 'thumbnail';

      if (this.pinnedSourceId && source.sourceId === this.pinnedSourceId) {
        priority = 1;
        quality = 'stage';
      } else if (source.type === 'screen') {
        priority = 2;
        quality = 'stage';
      } else if (this.activeSpeakerId && source.publisherId === this.activeSpeakerId && source.type === 'camera') {
        priority = 3;
        quality = 'normal';
      } else if (source.type === 'camera') {
        priority = 4;
        quality = 'thumbnail';
      } else if (source.type === 'audio') {
        priority = 5;
        quality = 'normal';
      }

      return { ...source, priority, quality };
    });

    // Sort by priority (lowest rank number = highest priority)
    scoredSources.sort((a, b) => a.priority - b.priority);

    // Allocate 9 visible slots
    const visiblePool = scoredSources.slice(viewportOffset, viewportOffset + this.maxVisibleCards);
    const visibleSourceIds = new Set(visiblePool.map((s) => s.sourceId));

    const nextSubscriptions = new Map();
    visiblePool.forEach((item) => {
      nextSubscriptions.set(item.sourceId, {
        sourceId: item.sourceId,
        publisherId: item.publisherId,
        type: item.type,
        quality: item.quality,
        priority: item.priority,
        visible: true
      });
    });

    // Detect diffs
    const added = [];
    const updated = [];
    const removed = [];

    for (const [sourceId, sub] of nextSubscriptions.entries()) {
      const existing = this.activeSubscriptions.get(sourceId);
      if (!existing) {
        added.push(sub);
      } else if (existing.quality !== sub.quality) {
        updated.push(sub);
      }
    }

    for (const [sourceId, existing] of this.activeSubscriptions.entries()) {
      if (!nextSubscriptions.has(sourceId)) {
        removed.push(existing);
      }
    }

    this.activeSubscriptions = nextSubscriptions;

    // Dispatch SUBSCRIBE(layer) control messages to upstream relays/senders
    remoteSources.forEach((source) => {
      const isVisible = visibleSourceIds.has(source.sourceId);
      const sub = nextSubscriptions.get(source.sourceId);
      let layer = 0;
      if (isVisible) {
        layer = sub?.quality === 'stage' ? 2 : 1;
      }
      this.emit('subscribeControl', {
        type: 'SUBSCRIBE',
        sourceId: source.sourceId,
        publisherId: source.publisherId,
        layer
      });
    });

    if (added.length > 0 || updated.length > 0 || removed.length > 0) {
      this.emit('subscriptionsChanged', {
        active: Array.from(this.activeSubscriptions.values()),
        added,
        updated,
        removed
      });
    }

    return Array.from(this.activeSubscriptions.values());
  }

  isSubscribed(sourceId) {
    return this.activeSubscriptions.has(sourceId);
  }

  getSubscription(sourceId) {
    return this.activeSubscriptions.get(sourceId) || null;
  }

  getActiveSubscriptions() {
    return Array.from(this.activeSubscriptions.values());
  }

  clear() {
    this.activeSubscriptions.clear();
    this.pinnedSourceId = null;
    this.listeners.clear();
  }
}
