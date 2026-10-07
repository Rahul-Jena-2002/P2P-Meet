/*
 * OpenMeet Client Core - HybridStrategy
 * Hybrid topology strategy: direct mesh for audio and active speakers, relay tree for screens and cameras.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class HybridStrategy {
  constructor({
    maxDirectPeers = 8,
    relayThreshold = 8
  } = {}) {
    this.maxDirectPeers = maxDirectPeers;
    this.relayThreshold = relayThreshold;
  }

  /**
   * Decide if two peers should connect directly or via relay overlay.
   */
  shouldConnect(localUser, remotePeer, totalCount = 1) {
    if (totalCount <= this.maxDirectPeers) {
      return true;
    }

    // In hybrid mode:
    // 1. Always connect directly to hosts and active screen presenters
    if (remotePeer.isHost || remotePeer.isScreenSharing) {
      return true;
    }

    // 2. Connect directly to active audio speakers
    if (remotePeer.isSpeaking) {
      return true;
    }

    return false;
  }

  /**
   * Whether a specific media source type should use the relay tree.
   */
  shouldRelaySource(sourceType, totalCount) {
    if (totalCount <= this.relayThreshold) return false;
    // Screen sharing produces high bitrate frames (1080p text/presentation) -> always relay in hybrid
    if (sourceType === 'screen') return true;
    return totalCount > 16;
  }
}
