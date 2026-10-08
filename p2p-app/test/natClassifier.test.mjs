import test from 'node:test';
import assert from 'node:assert/strict';
import { NatClassifier } from '../src/core/topology/NatClassifier.js';

test('NatClassifier labels NAT as reachable when mapped ports from both STUN servers match', async () => {
  const classifier = new NatClassifier({
    stunQuerier: async (stunUrl) => {
      // Mock deterministic STUN query returning same mapped external port
      return { ip: '203.0.113.10', port: 40500 };
    }
  });

  const result = await classifier.classify();
  assert.equal(result.natType, 'reachable');
  assert.equal(result.isSymmetric, false);
  assert.equal(result.mappedIp, '203.0.113.10');
});

test('NatClassifier labels NAT as restricted when mapped ports differ across STUN servers (Symmetric NAT)', async () => {
  const classifier = new NatClassifier({
    stunQuerier: async (stunUrl) => {
      // Mock symmetric NAT behavior where port differs per destination
      if (stunUrl.includes('google')) {
        return { ip: '203.0.113.10', port: 40500 };
      } else {
        return { ip: '203.0.113.10', port: 40501 };
      }
    }
  });

  const result = await classifier.classify();
  assert.equal(result.natType, 'restricted');
  assert.equal(result.isSymmetric, true);
});

test('evaluateRoomConnectivity detects all-symmetric NAT condition and fails gracefully', () => {
  const classifier = new NatClassifier();

  // Scenario 1: All peers are restricted (symmetric NAT)
  const allSymmetricPeers = [
    { peerId: 'peer-1', natType: 'restricted' },
    { peerId: 'peer-2', natType: 'restricted' },
    { peerId: 'peer-3', natType: 'restricted' }
  ];

  const eval1 = classifier.evaluateRoomConnectivity(allSymmetricPeers);
  assert.equal(eval1.canConnect, false);
  assert.match(eval1.reason, /symmetric|restricted/i);

  // Scenario 2: At least one peer is reachable and can act as bridge/relay
  const mixedPeers = [
    { peerId: 'peer-1', natType: 'restricted' },
    { peerId: 'peer-2', natType: 'reachable' },
    { peerId: 'peer-3', natType: 'restricted' }
  ];

  const eval2 = classifier.evaluateRoomConnectivity(mixedPeers);
  assert.equal(eval2.canConnect, true);
  assert.equal(eval2.bridgePeerId, 'peer-2');
});
