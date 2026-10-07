/*
 * OpenMeet Client Core - RelayCapacityEstimator
 * Dynamic calculation of peer relay capacity, safe upload budgets, and fanout limits.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class RelayCapacityEstimator {
  constructor({
    policyMaxFanout = 5,
    defaultStreamBitrateBps = 1_500_000, // 1.5 Mbps default
    safetyMargin = 0.60                  // 60% safe upload budget
  } = {}) {
    this.policyMaxFanout = policyMaxFanout;
    this.defaultStreamBitrateBps = defaultStreamBitrateBps;
    this.safetyMargin = safetyMargin;
  }

  /**
   * Estimate a node's relay capacity and score from measured telemetry.
   * @param {Object} metrics
   * @param {number} metrics.measuredUploadBps - WebRTC estimated available outgoing bitrate
   * @param {number} metrics.avgRttMs - Average round-trip time in milliseconds
   * @param {number} metrics.packetLossPercent - Packet loss percentage (0 - 100)
   * @param {string} [metrics.deviceType='desktop'] - 'desktop' | 'laptop' | 'mobile' | 'tablet'
   * @param {boolean} [metrics.isCharging=true]
   * @param {number} [metrics.batteryLevel=1.0] - 0.0 to 1.0
   * @param {number} [metrics.cpuLoad=0.2] - 0.0 to 1.0
   * @param {number} [metrics.currentAssignedRelays=0] - Number of currently forwarded child tracks
   */
  estimate(metrics = {}) {
    const measuredUploadBps = Math.max(0, metrics.measuredUploadBps || 5_000_000); // 5 Mbps fallback
    const avgRttMs = metrics.avgRttMs ?? 35;
    const packetLossPercent = metrics.packetLossPercent ?? 0.0;
    const deviceType = metrics.deviceType || 'desktop';
    const isCharging = metrics.isCharging ?? true;
    const batteryLevel = metrics.batteryLevel ?? 1.0;
    const cpuLoad = metrics.cpuLoad ?? 0.2;
    const currentAssignedRelays = metrics.currentAssignedRelays || 0;

    // 1. Safe Upload Budget
    const safeUploadBudgetBps = Math.floor(measuredUploadBps * this.safetyMargin);

    // 2. Base Fanout Calculation
    let fanout = Math.floor(safeUploadBudgetBps / this.defaultStreamBitrateBps);

    // Mobile / battery-constrained devices must NEVER be overloaded with relay duties
    if (deviceType === 'mobile' || (deviceType === 'tablet' && !isCharging)) {
      fanout = 0; // leaf subscriber only
    } else if (!isCharging && batteryLevel < 0.35) {
      fanout = 0; // low battery device disqualified
    } else if (cpuLoad > 0.80) {
      fanout = Math.min(1, fanout); // CPU constrained
    }

    const maxFanout = Math.max(0, Math.min(this.policyMaxFanout, fanout));
    const availableFanout = Math.max(0, maxFanout - currentAssignedRelays);

    // 3. Composite Relay Score Calculation (Higher is better)
    // S_upload (0 - 40)
    const uploadScore = Math.min(40, (safeUploadBudgetBps / 2_000_000) * 10);

    // S_stability (0 - 30)
    const stabilityScore = Math.max(0, 30 - (avgRttMs / 10) - (packetLossPercent * 5));

    // S_device (0 - 25)
    let deviceScore = 10;
    if (deviceType === 'desktop' && isCharging) deviceScore = 25;
    else if (deviceType === 'laptop' && isCharging) deviceScore = 20;
    else if (deviceType === 'laptop' && batteryLevel > 0.5) deviceScore = 12;
    else if (deviceType === 'mobile') deviceScore = -30;

    // Penalties
    const cpuPenalty = cpuLoad > 0.6 ? (cpuLoad - 0.6) * 40 : 0;
    const loadPenalty = currentAssignedRelays * 8;
    const batteryPenalty = (!isCharging && batteryLevel < 0.4) ? 35 : 0;

    const rawScore = uploadScore + stabilityScore + deviceScore - cpuPenalty - loadPenalty - batteryPenalty;
    const relayScore = Math.max(0, Math.round(rawScore));

    return {
      measuredUploadBps,
      safeUploadBudgetBps,
      maxFanout,
      currentAssignedRelays,
      availableFanout,
      relayScore,
      isEligible: availableFanout > 0 && relayScore >= 30,
      timestamp: Date.now()
    };
  }
}
