/*
 * OpenMeet Client Core - RelayTreeStrategy
 * Multi-tier bounded-depth tree distribution for large and very large rooms (N > 30).
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class RelayTreeStrategy {
  constructor({
    maxPublisherFanout = 4,
    maxTreeDepth = 3,
    relaySelector = null
  } = {}) {
    this.maxPublisherFanout = maxPublisherFanout;
    this.maxTreeDepth = maxTreeDepth;
    this.relaySelector = relaySelector;
  }

  /**
   * Constructs routing tree for a given source:
   * Level 0: Publisher
   * Level 1: Up to maxPublisherFanout top-scored relays
   * Level 2..maxTreeDepth: Children distributed among relays
   *
   * @param {Object} options
   * @param {string} options.sourceId
   * @param {string} options.publisherId
   * @param {Array<string>} options.subscriberIds
   * @param {Array<string>} [options.candidateRelayIds]
   * @returns {Array<{ parentId: string, childId: string, level: number }>} Array of directed parent->child routing assignments
   */
  buildTreeRoutes({
    sourceId,
    publisherId,
    subscriberIds = [],
    candidateRelayIds = []
  } = {}) {
    const assignments = [];
    const remainingSubscribers = subscriberIds.filter((id) => id !== publisherId);
    if (remainingSubscribers.length === 0) return assignments;

    // 1. If subscriber count is less than publisher fanout, direct publisher distribution
    if (remainingSubscribers.length <= this.maxPublisherFanout) {
      remainingSubscribers.forEach((subId) => {
        assignments.push({ parentId: publisherId, childId: subId, level: 1 });
      });
      return assignments;
    }

    // 2. Select Level 1 Core Relays
    let level1Relays = [];
    if (this.relaySelector) {
      level1Relays = this.relaySelector.selectTopRelays(this.maxPublisherFanout, [publisherId]);
    }

    // Fallback: use first few candidate relays or subscribers if no scored relays
    if (level1Relays.length === 0) {
      level1Relays = (candidateRelayIds.length > 0 ? candidateRelayIds : remainingSubscribers)
        .filter((id) => id !== publisherId)
        .slice(0, this.maxPublisherFanout);
    }

    // Connect publisher to each Level 1 Relay
    level1Relays.forEach((relayId) => {
      assignments.push({ parentId: publisherId, childId: relayId, level: 1 });
    });

    // 3. Distribute remaining subscribers evenly across Level 1 Relays (Level 2)
    const level2Subscribers = remainingSubscribers.filter((id) => !level1Relays.includes(id));
    if (level1Relays.length > 0) {
      level2Subscribers.forEach((subId, idx) => {
        const parentRelayId = level1Relays[idx % level1Relays.length];
        assignments.push({ parentId: parentRelayId, childId: subId, level: 2 });
      });
    }

    return assignments;
  }

  shouldConnect(localUser, remotePeer) {
    // In pure relay tree, connections are directed by assigned routes
    return false;
  }
}
