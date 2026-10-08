import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyManager } from '../src/core/crypto/KeyManager.js';

test('KeyManager computes pairwise ECDH shared secret and wraps/unwraps media key', async () => {
  const alice = new KeyManager();
  const bob = new KeyManager();

  const aliceEcdh = await alice.generateEcdhKeyPair();
  const bobEcdh = await bob.generateEcdhKeyPair();

  // Alice generates an epoch media key (raw 16 bytes for AES-GCM 128)
  const epoch = 1;
  const rawMediaKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

  // Alice wraps media key for Bob
  const wrapped = await alice.wrapKeyForPeer({
    targetPeerId: 'bob',
    myPrivateKey: aliceEcdh.privateKey,
    targetPublicKeyJwk: bobEcdh.publicKeyJwk,
    rawKeyBytes: rawMediaKey,
    epoch
  });

  assert.equal(wrapped.epoch, 1);
  assert.ok(wrapped.ciphertextHex);
  assert.ok(wrapped.ivHex);

  // Bob unwraps media key sent by Alice
  const unwrapped = await bob.unwrapKeyFromPeer({
    senderPeerId: 'alice',
    myPrivateKey: bobEcdh.privateKey,
    senderPublicKeyJwk: aliceEcdh.publicKeyJwk,
    wrapped
  });

  assert.deepEqual(unwrapped, rawMediaKey, 'Unwrapped key must match original media key');
});

test('KeyManager advances epoch and invalidates departed peer on peerLeave', async () => {
  const alice = new KeyManager();
  await alice.initSession({ peerId: 'alice' });

  assert.equal(alice.epoch, 1);
  const epoch1Key = await alice.getCurrentMediaKey();
  assert.ok(epoch1Key);

  // Peer leaves room
  const newEpoch = await alice.handlePeerLeave('dropped-peer-charlie');
  assert.equal(newEpoch, 2);
  assert.equal(alice.epoch, 2);

  // New epoch produces a fresh media key
  const epoch2Key = await alice.getCurrentMediaKey();
  assert.notDeepEqual(epoch2Key, epoch1Key, 'New epoch must ratchet to a new media key');

  // Verify dropped peer has no active session state
  assert.equal(alice.hasPeerState('dropped-peer-charlie'), false);
});
