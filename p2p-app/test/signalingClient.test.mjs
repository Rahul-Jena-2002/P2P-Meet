import test from 'node:test';
import assert from 'node:assert/strict';
import { SignalingClient } from '../src/core/signaling/SignalingClient.js';

test('SignalingClient correctly computes room topics', () => {
  const client = new SignalingClient({
    roomId: 'abc123',
    userId: 'user-1',
    userName: 'Alice'
  });

  assert.equal(client.roomId, 'ABC123');
  assert.equal(client.broadcastTopic, 'p2pmeet/r/ABC123/all');
  assert.equal(client.peerTopic, 'p2pmeet/r/ABC123/p/user-1');
});

test('SignalingClient dispatches parsed incoming messages to event listeners', () => {
  const client = new SignalingClient({
    roomId: 'TEST',
    userId: 'user-1',
    userName: 'Alice'
  });

  let joinedPeer = null;
  client.on('peer-joined', ({ userId, userName }) => {
    joinedPeer = { userId, userName };
  });

  // Simulate incoming broadcast message
  client.handleMessage(client.broadcastTopic, {
    type: 'user-joined',
    userId: 'user-2',
    userName: 'Bob'
  });

  assert.deepEqual(joinedPeer, { userId: 'user-2', userName: 'Bob' });
});

test('SignalingClient ignores self-published messages', () => {
  const client = new SignalingClient({
    roomId: 'TEST',
    userId: 'user-1',
    userName: 'Alice'
  });

  let received = false;
  client.on('peer-joined', () => {
    received = true;
  });

  // Simulate self message
  client.handleMessage(client.broadcastTopic, {
    type: 'user-joined',
    userId: 'user-1',
    userName: 'Alice'
  });

  assert.equal(received, false);
});
