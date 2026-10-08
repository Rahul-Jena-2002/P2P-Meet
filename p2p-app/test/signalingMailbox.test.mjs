import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyManager } from '../src/core/crypto/KeyManager.js';
import { SignalingMailbox } from '../src/core/signaling/SignalingMailbox.js';

test('KeyManager derives deterministic mailbox topic using HKDF from room secret', async () => {
  const km = new KeyManager();
  const roomId = 'room-alpha';
  const secret1 = 'super-secret-key-123';
  const secret2 = 'different-secret-456';

  const topic1a = await km.deriveTopic(roomId, secret1);
  const topic1b = await km.deriveTopic(roomId, secret1);
  const topic2 = await km.deriveTopic(roomId, secret2);

  assert.equal(typeof topic1a, 'string');
  assert.equal(topic1a.length, 64); // 256-bit hex
  assert.equal(topic1a, topic1b, 'Derivation must be deterministic');
  assert.notEqual(topic1a, topic2, 'Different secrets must yield different topics');
});

test('KeyManager generates ephemeral ECDSA keypair and signs/verifies data', async () => {
  const km = new KeyManager();
  const keyPair = await km.generateSigningKeyPair();
  const payload = 'a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';

  const signature = await km.signPayload(keyPair.privateKey, payload);
  assert.equal(typeof signature, 'string');

  const isValid = await km.verifyPayload(keyPair.publicKeyJwk, signature, payload);
  assert.equal(isValid, true, 'Valid signature must verify');

  const isTamperedValid = await km.verifyPayload(keyPair.publicKeyJwk, signature, payload + '-tampered');
  assert.equal(isTamperedValid, false, 'Tampered payload must fail verification');
});

test('SignalingMailbox packages SDP offer with signed DTLS fingerprint', async () => {
  const km = new KeyManager();
  const mailbox = new SignalingMailbox({
    roomId: 'room-alpha',
    roomSecret: 'room-secret-xyz',
    peerId: 'peer-alice',
    keyManager: km
  });
  await mailbox.init();

  const fakeSdp = 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';

  const envelope = await mailbox.createEnvelope({
    type: 'offer',
    sdp: fakeSdp
  });

  assert.equal(envelope.peerId, 'peer-alice');
  assert.equal(envelope.type, 'offer');
  assert.equal(envelope.sdp, fakeSdp);
  assert.equal(envelope.fingerprint, '11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF');
  assert.ok(envelope.signature);
  assert.ok(envelope.publicKeyJwk);

  // Receiving valid envelope
  const verified = await mailbox.verifyAndUnwrapEnvelope(envelope);
  assert.equal(verified.valid, true);
  assert.equal(verified.sdp, fakeSdp);
});

test('SignalingMailbox rejects envelope if SDP or DTLS fingerprint is tampered in transit', async () => {
  const km = new KeyManager();
  const aliceMailbox = new SignalingMailbox({
    roomId: 'room-alpha',
    roomSecret: 'room-secret-xyz',
    peerId: 'peer-alice',
    keyManager: km
  });
  await aliceMailbox.init();

  const bobMailbox = new SignalingMailbox({
    roomId: 'room-alpha',
    roomSecret: 'room-secret-xyz',
    peerId: 'peer-bob',
    keyManager: km
  });
  await bobMailbox.init();

  const fakeSdp = 'v=0\r\na=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
  const envelope = await aliceMailbox.createEnvelope({
    type: 'offer',
    sdp: fakeSdp
  });

  // Scenario 1: Malicious relay alters the SDP fingerprint line to hijack DTLS
  const tamperedEnvelope1 = {
    ...envelope,
    sdp: fakeSdp.replace('AA:BB:CC', '99:99:99')
  };
  const result1 = await bobMailbox.verifyAndUnwrapEnvelope(tamperedEnvelope1);
  assert.equal(result1.valid, false);
  assert.match(result1.error, /tamper|mismatch|fingerprint/i);

  // Scenario 2: Malicious relay alters the signed fingerprint field directly
  const tamperedEnvelope2 = {
    ...envelope,
    fingerprint: '99:99:99:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'
  };
  const result2 = await bobMailbox.verifyAndUnwrapEnvelope(tamperedEnvelope2);
  assert.equal(result2.valid, false);
  assert.match(result2.error, /tamper|signature/i);
});

test('KeyManager derives root key tree: topic, room auth key, and initial media key', async () => {
  const km = new KeyManager();
  const rootKeys = await km.deriveRootKeys('room-101', 'secret-pass-abc');

  assert.equal(typeof rootKeys.mailboxTopic, 'string');
  assert.equal(rootKeys.mailboxTopic.length, 64);
  assert.ok(rootKeys.roomAuthKey, 'roomAuthKey must be generated');
  assert.ok(rootKeys.initialMediaKey instanceof Uint8Array);
  assert.equal(rootKeys.initialMediaKey.byteLength, 16);

  // Auth token generation and verification
  const token = await km.createRoomAuthToken(rootKeys.roomAuthKey, {
    peerId: 'peer-alice',
    timestamp: 123456789
  });
  assert.equal(typeof token, 'string');

  const isValid = await km.verifyRoomAuthToken(rootKeys.roomAuthKey, token, {
    peerId: 'peer-alice',
    timestamp: 123456789
  });
  assert.equal(isValid, true);

  // Attacker with different key or tampered timestamp fails
  const attackerKeys = await km.deriveRootKeys('room-101', 'attacker-wrong-secret');
  const isAttackerValid = await km.verifyRoomAuthToken(attackerKeys.roomAuthKey, token, {
    peerId: 'peer-alice',
    timestamp: 123456789
  });
  assert.equal(isAttackerValid, false, 'Attacker with wrong room secret must fail auth token verification');
});

test('SignalingMailbox rejects unauthorized attacker envelope without roomSecret', async () => {
  const km = new KeyManager();

  // Legitimate user in the room with correct room secret
  const bobMailbox = new SignalingMailbox({
    roomId: 'room-secure',
    roomSecret: 'correct-secret-456',
    peerId: 'peer-bob',
    keyManager: km
  });
  await bobMailbox.init();

  // Attacker sniffing the public topic who generates their own SDP offer with their own ECDSA key,
  // but lacks the roomSecret (or has wrong secret)
  const attackerMailbox = new SignalingMailbox({
    roomId: 'room-secure',
    roomSecret: 'rogue-attacker-secret',
    peerId: 'attacker-eve',
    keyManager: km
  });
  await attackerMailbox.init();

  const fakeSdp = 'v=0\r\na=fingerprint:sha-256 CC:CC:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
  const attackerEnvelope = await attackerMailbox.createEnvelope({
    type: 'offer',
    sdp: fakeSdp
  });

  // Bob receives attacker's envelope
  const result = await bobMailbox.verifyAndUnwrapEnvelope(attackerEnvelope);
  assert.equal(result.valid, false);
  assert.match(result.error, /unauthorized|room auth/i, 'Bob must reject unauthorized peer');
});

