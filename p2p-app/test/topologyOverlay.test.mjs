import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TopologyManager,
  OverlayManager,
  RelaySelector,
  RelayCapacityEstimator,
  HybridStrategy,
  RelayTreeStrategy
} from '../src/core/topology/TopologyManager.js';

test('RelayCapacityEstimator computes safe upload and fanout correctly', () => {
  const estimator = new RelayCapacityEstimator({
    defaultStreamBitrateBps: 2_000_000 // 2 Mbps stream
  });

  // 1. High capacity desktop peer (30 Mbps upload)
  const desktopResult = estimator.estimate({
    measuredUploadBps: 30_000_000,
    deviceType: 'desktop',
    isCharging: true,
    avgRttMs: 25,
    packetLossPercent: 0.1
  });

  assert.equal(desktopResult.safeUploadBudgetBps, 18_000_000); // 30M * 0.6 = 18M
  assert.equal(desktopResult.maxFanout, 5); // capped at policy 5
  assert.equal(desktopResult.isEligible, true);
  assert.ok(desktopResult.relayScore > 60);

  // 2. Mobile device on battery (must NOT be a relay)
  const mobileResult = estimator.estimate({
    measuredUploadBps: 20_000_000,
    deviceType: 'mobile',
    isCharging: false,
    batteryLevel: 0.25
  });

  assert.equal(mobileResult.maxFanout, 0); // fanout 0
  assert.equal(mobileResult.isEligible, false);
});

test('RelaySelector selects the best eligible candidate', () => {
  const selector = new RelaySelector();

  selector.updatePeerCapacity('peer-desktop-fiber', {
    measuredUploadBps: 50_000_000,
    deviceType: 'desktop',
    avgRttMs: 15
  });

  selector.updatePeerCapacity('peer-laptop-wifi', {
    measuredUploadBps: 10_000_000,
    deviceType: 'laptop',
    avgRttMs: 80
  });

  selector.updatePeerCapacity('peer-phone', {
    measuredUploadBps: 25_000_000,
    deviceType: 'mobile',
    batteryLevel: 0.2
  });

  const chosen = selector.selectRelayForSource({
    sourceId: 'publisher:camera',
    publisherId: 'publisher'
  });

  assert.equal(chosen, 'peer-desktop-fiber');

  // If excluding peer-desktop-fiber, fallback to peer-laptop-wifi
  const fallback = selector.selectRelayForSource({
    sourceId: 'publisher:camera',
    publisherId: 'publisher',
    excludePeerIds: ['peer-desktop-fiber']
  });

  assert.equal(fallback, 'peer-laptop-wifi');
});

test('OverlayManager routes tree parent/child relationships and emits forward signals', () => {
  const overlay = new OverlayManager({ localUserId: 'node-relay-A' });

  let forwardRequiredEvent = null;
  overlay.on('forwardTrackRequired', (ev) => {
    forwardRequiredEvent = ev;
  });

  // Assign node-relay-A as parent for child-1 receiving rahul:screen
  overlay.assignRelay({
    sourceId: 'rahul:screen',
    parentPeerId: 'node-relay-A',
    childPeerId: 'child-1'
  });

  assert.ok(forwardRequiredEvent);
  assert.equal(forwardRequiredEvent.sourceId, 'rahul:screen');
  assert.equal(forwardRequiredEvent.childPeerId, 'child-1');

  const children = overlay.getForwardingChildren('rahul:screen');
  assert.deepEqual(children, ['child-1']);

  // Removing relay emits stop
  let forwardStopEvent = null;
  overlay.on('forwardTrackStop', (ev) => {
    forwardStopEvent = ev;
  });

  overlay.removeRelay({
    sourceId: 'rahul:screen',
    parentPeerId: 'node-relay-A',
    childPeerId: 'child-1'
  });

  assert.ok(forwardStopEvent);
  assert.equal(forwardStopEvent.childPeerId, 'child-1');
  assert.equal(overlay.getForwardingChildren('rahul:screen').length, 0);
});

test('RelayTreeStrategy builds 2-tier tree distribution routes with bounded depth', () => {
  const strategy = new RelayTreeStrategy({
    maxPublisherFanout: 2,
    maxTreeDepth: 3
  });

  const routes = strategy.buildTreeRoutes({
    sourceId: 'rahul:screen',
    publisherId: 'rahul',
    subscriberIds: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
    candidateRelayIds: ['user-1', 'user-2']
  });

  assert.equal(routes.length, 5);

  // Level 1: publisher -> user-1, publisher -> user-2
  const level1 = routes.filter((r) => r.level === 1);
  assert.equal(level1.length, 2);
  assert.equal(level1[0].parentId, 'rahul');
  assert.equal(level1[1].parentId, 'rahul');

  // Level 2: user-1/user-2 -> user-3, user-4, user-5
  const level2 = routes.filter((r) => r.level === 2);
  assert.equal(level2.length, 3);
  assert.ok(level2.every((r) => r.parentId === 'user-1' || r.parentId === 'user-2'));
});

test('TopologyManager automatically adapts topology mode according to room size', () => {
  const tm = new TopologyManager({ localUserId: 'me' });
  assert.equal(tm.getMode(), 'mesh');

  // Add 8 peers (total 9 participants) -> shifts to hybrid
  for (let i = 1; i <= 8; i++) {
    tm.evaluatePeer({ id: `peer-${i}` });
  }
  assert.equal(tm.getMode(), 'hybrid');

  // Add more peers to exceed 30 participants -> shifts to relay-tree
  for (let i = 9; i <= 35; i++) {
    tm.evaluatePeer({ id: `peer-${i}` });
  }
  assert.equal(tm.getMode(), 'relay-tree');
});
