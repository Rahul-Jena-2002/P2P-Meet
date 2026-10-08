import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteControlAgent } from '../src/core/control/RemoteControlAgent.js';

test('RemoteControlAgent drops remote control events if consent is not granted', () => {
  const agent = new RemoteControlAgent({ localUserId: 'user-host' });

  let actionExecuted = false;
  agent.on('actionExecuted', () => {
    actionExecuted = true;
  });

  const mouseAction = {
    type: 'mousemove',
    x: 0.5,
    y: 0.5
  };

  // Attempt to execute without consent
  const result = agent.handleRemoteAction('user-guest', mouseAction);

  assert.equal(result.executed, false);
  assert.equal(actionExecuted, false, 'Action must be dropped when consent is not granted');
  assert.match(result.reason, /consent/i);
});

test('RemoteControlAgent allows events only after explicit consent is granted and drops on revoke', () => {
  const agent = new RemoteControlAgent({ localUserId: 'user-host' });

  const executedActions = [];
  agent.on('actionExecuted', ({ action }) => {
    executedActions.push(action);
  });

  // Host explicitly grants consent to user-guest
  agent.grantConsent('user-guest');
  assert.equal(agent.isConsentGranted('user-guest'), true);

  // Guest sends mouse click
  const clickAction = { type: 'mousedown', button: 0, x: 0.25, y: 0.75 };
  const res1 = agent.handleRemoteAction('user-guest', clickAction);
  assert.equal(res1.executed, true);
  assert.equal(executedActions.length, 1);
  assert.deepEqual(executedActions[0], clickAction);

  // Different unauthorized peer attempts to control
  const unauthRes = agent.handleRemoteAction('user-attacker', clickAction);
  assert.equal(unauthRes.executed, false);
  assert.equal(executedActions.length, 1, 'Attacker action must be rejected');

  // Host revokes consent
  agent.revokeConsent();
  assert.equal(agent.isConsentGranted('user-guest'), false);

  const res2 = agent.handleRemoteAction('user-guest', clickAction);
  assert.equal(res2.executed, false);
  assert.equal(executedActions.length, 1, 'Subsequent actions must be dropped after consent revoke');
});

test('RemoteControlAgent encrypts and decrypts actions over control plane', async () => {
  const agent = new RemoteControlAgent({ localUserId: 'user-host' });
  agent.grantConsent('user-guest');

  const mediaKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 128 },
    true,
    ['encrypt', 'decrypt']
  );

  const rawAction = { type: 'keydown', key: 'Enter' };
  const encryptedPayload = await agent.encryptAction(rawAction, mediaKey);

  assert.ok(encryptedPayload.ciphertextHex);
  assert.ok(encryptedPayload.ivHex);

  const decryptedResult = await agent.receiveEncryptedAction('user-guest', encryptedPayload, mediaKey);
  assert.equal(decryptedResult.executed, true);
  assert.deepEqual(decryptedResult.action, rawAction);
});
