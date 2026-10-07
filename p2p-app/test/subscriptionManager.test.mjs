import test from 'node:test';
import assert from 'node:assert/strict';
import { SubscriptionManager } from '../src/core/topology/SubscriptionManager.js';

test('SubscriptionManager prioritizes pinned source and screen shares within 9-card viewport', () => {
  const sm = new SubscriptionManager({ localUserId: 'me', maxVisibleCards: 9 });

  const roomSources = [
    { sourceId: 'user-1:camera', publisherId: 'user-1', type: 'camera' },
    { sourceId: 'user-2:camera', publisherId: 'user-2', type: 'camera' },
    { sourceId: 'user-3:screen', publisherId: 'user-3', type: 'screen' },
    { sourceId: 'user-4:camera', publisherId: 'user-4', type: 'camera' }
  ];

  // Set pin on user-4:camera
  sm.setPinnedSource('user-4:camera');

  const subs = sm.evaluateSubscriptions(roomSources);
  assert.equal(subs.length, 4);

  // 1. user-4:camera should be rank 1 with stage quality
  assert.equal(subs[0].sourceId, 'user-4:camera');
  assert.equal(subs[0].quality, 'stage');

  // 2. user-3:screen should be rank 2 with stage quality
  assert.equal(subs[1].sourceId, 'user-3:screen');
  assert.equal(subs[1].quality, 'stage');

  // 3. remaining cameras should be thumbnail quality
  assert.equal(subs[2].quality, 'thumbnail');
  assert.equal(subs[3].quality, 'thumbnail');
});

test('SubscriptionManager bounds active subscriptions to maxVisibleCards (9)', () => {
  const sm = new SubscriptionManager({ localUserId: 'me', maxVisibleCards: 9 });

  // 20 participants in room
  const roomSources = [];
  for (let i = 1; i <= 20; i++) {
    roomSources.push({ sourceId: `user-${i}:camera`, publisherId: `user-${i}`, type: 'camera' });
  }

  const subs = sm.evaluateSubscriptions(roomSources);
  assert.equal(subs.length, 9); // strictly capped to 9 cards
});

test('SubscriptionManager automatically unpins when pinned source closes', () => {
  const sm = new SubscriptionManager({ localUserId: 'me', maxVisibleCards: 9 });

  sm.setPinnedSource('user-presentation:screen');
  assert.equal(sm.pinnedSourceId, 'user-presentation:screen');

  // Presenter closes screen share
  const activeSources = [
    { sourceId: 'user-1:camera', publisherId: 'user-1', type: 'camera' }
  ];

  sm.evaluateSubscriptions(activeSources);
  assert.equal(sm.pinnedSourceId, null); // cleanly unpinned
});
