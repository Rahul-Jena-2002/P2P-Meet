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
