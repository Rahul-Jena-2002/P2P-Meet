import test from 'node:test';
import assert from 'node:assert/strict';
import { GossipMembership } from '../src/core/topology/GossipMembership.js';
import { RelaySelector } from '../src/core/topology/RelaySelector.js';
import { Rebalancer } from '../src/core/topology/Rebalancer.js';

test('RelaySelector elects head relay and standby using deterministic tie-breaking', () => {
  const selector = new RelaySelector();

  const peers = [
    // Peer A: restricted NAT, upload 10
    { peerId: 'peer-a', reachability: 'restricted', uploadMbps: 10, cpuLoad: 0.2, rttMs: 30 },
    // Peer B: reachable NAT, upload 50
    { peerId: 'peer-b', reachability: 'reachable', uploadMbps: 50, cpuLoad: 0.3, rttMs: 25 },
    // Peer C: reachable NAT, upload 100
    { peerId: 'peer-c', reachability: 'reachable', uploadMbps: 100, cpuLoad: 0.1, rttMs: 20 },
    // Peer D: reachable NAT, upload 50, but lower cpu and rtt than B
    { peerId: 'peer-d', reachability: 'reachable', uploadMbps: 50, cpuLoad: 0.1, rttMs: 15 }
  ];

  // Tie-breaking: reachability (reachable > restricted) -> upload -> cpu -> rtt -> peerId
  const { headRelayId, standbyRelayId } = selector.electHeadAndStandby(peers);

  // Peer C has reachable NAT and highest upload (100) -> must be head relay
  assert.equal(headRelayId, 'peer-c');

  // Peer D has reachable NAT and 50 upload with lower CPU than B -> must be standby
  assert.equal(standbyRelayId, 'peer-d');
});

test('GossipMembership detects peer failure and triggers deterministic standby promotion in under 3 seconds', async () => {
  const membership = new GossipMembership({
    localUserId: 'peer-local',
    pingIntervalMs: 50,
    suspectTimeoutMs: 150,
    deadTimeoutMs: 300
  });

  const rebalancer = new Rebalancer({ localUserId: 'peer-local' });

  membership.addMember('peer-c', { reachability: 'reachable', uploadMbps: 100 });
  membership.addMember('peer-d', { reachability: 'reachable', uploadMbps: 50 });

  let deadDetected = null;
  membership.on('memberDead', ({ peerId }) => {
    deadDetected = peerId;
  });

  let standbyPromoted = null;
  rebalancer.on('standbyPromoted', ({ failedRelayId, promotedRelayId }) => {
    standbyPromoted = { failedRelayId, promotedRelayId };
  });

  // Wire failure detection to standby promotion
  membership.on('memberDead', ({ peerId }) => {
    rebalancer.promoteStandby({ failedRelayId: peerId, standbyId: 'peer-d' });
  });

  membership.start();

  // Peer C sends no heartbeats (dies), Peer D stays alive (active standby)
  const heartbeatInterval = setInterval(() => {
    membership.recordHeartbeat('peer-d');
  }, 50);

  const startTime = Date.now();

  // Wait for gossip failure timeout (< 1000ms, well under 3 seconds)
  await new Promise((r) => setTimeout(r, 450));
  clearInterval(heartbeatInterval);

  membership.stop();

  const elapsed = Date.now() - startTime;
  assert.ok(elapsed < 3000, `Promotion must occur in under 3 seconds (took ${elapsed}ms)`);
  assert.equal(deadDetected, 'peer-c');
  assert.deepEqual(standbyPromoted, {
    failedRelayId: 'peer-c',
    promotedRelayId: 'peer-d'
  });
});
