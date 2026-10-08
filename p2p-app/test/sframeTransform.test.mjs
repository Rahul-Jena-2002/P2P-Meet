import test from 'node:test';
import assert from 'node:assert/strict';
import { SFrameTransform } from '../src/core/media/SFrameTransform.js';
import { ForwardingBridge } from '../src/core/rtc/ForwardingBridge.js';

test('SFrameTransform encrypts and decrypts frame payloads using AES-GCM', async () => {
  const sframe = new SFrameTransform();
  const rawPayload = new TextEncoder().encode('raw-unencrypted-h264-nal-units-or-opus-packets');
  const mediaKey = await sframe.generateMediaKey();

  const encryptedData = await sframe.encryptPayload(rawPayload, mediaKey, 1);
  assert.notDeepEqual(encryptedData, rawPayload, 'Encrypted data must not match raw plaintext');
  assert.ok(encryptedData.byteLength > rawPayload.byteLength, 'Encrypted frame includes SFrame header and auth tag');

  const decryptedData = await sframe.decryptPayload(encryptedData, mediaKey);
  assert.deepEqual(decryptedData, rawPayload, 'Decrypted data must match original payload');
});

test('SFrameTransform fails decryption if key is invalid or ciphertext is tampered', async () => {
  const sframe = new SFrameTransform();
  const rawPayload = new TextEncoder().encode('secret-confidential-audio');
  const mediaKey1 = await sframe.generateMediaKey();
  const mediaKey2 = await sframe.generateMediaKey();

  const encryptedData = await sframe.encryptPayload(rawPayload, mediaKey1, 10);

  // Decryption with wrong key must fail
  await assert.rejects(
    async () => {
      await sframe.decryptPayload(encryptedData, mediaKey2);
    },
    /decrypt|tag|cipher/i
  );

  // Decryption of tampered ciphertext must fail
  const tampered = new Uint8Array(encryptedData);
  tampered[tampered.length - 2] ^= 0xff; // flip bit in tag/ciphertext
  await assert.rejects(
    async () => {
      await sframe.decryptPayload(tampered, mediaKey1);
    },
    /decrypt|tag|cipher/i
  );
});

test('SFrameTransform pipeline: sender encrypts, relay passes raw ciphertext, receiver decrypts', async () => {
  const sframe = new SFrameTransform();
  const mediaKey = await sframe.generateMediaKey();

  const originalPlaintext = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1f]); // mock H.264 NAL
  const mockFrame = {
    type: 'key',
    timestamp: 123456,
    data: new ArrayBuffer(originalPlaintext.byteLength)
  };
  new Uint8Array(mockFrame.data).set(originalPlaintext);

  // 1. Sender transform
  const senderTransform = sframe.createSenderTransform(mediaKey, 1);
  const senderWriter = senderTransform.writable.getWriter();
  const senderReader = senderTransform.readable.getReader();

  const sendPromise = senderWriter.write(mockFrame);
  const { value: encryptedFrame } = await senderReader.read();
  await sendPromise;

  assert.notDeepEqual(new Uint8Array(encryptedFrame.data), originalPlaintext);

  // 2. Relay pass-through (Relay has ZERO keys, passes raw encrypted frame)
  const relayTransform = sframe.createRelayPassthroughTransform();
  const relayWriter = relayTransform.writable.getWriter();
  const relayReader = relayTransform.readable.getReader();

  const relayPromise = relayWriter.write(encryptedFrame);
  const { value: relayedFrame } = await relayReader.read();
  await relayPromise;

  assert.deepEqual(new Uint8Array(relayedFrame.data), new Uint8Array(encryptedFrame.data), 'Relay passes raw ciphertext');

  // 3. Receiver transform (has mediaKey, decrypts)
  const receiverTransform = sframe.createReceiverTransform(async () => mediaKey);
  const receiverWriter = receiverTransform.writable.getWriter();
  const receiverReader = receiverTransform.readable.getReader();

  const receiverPromise = receiverWriter.write(relayedFrame);
  const { value: decryptedFrame } = await receiverReader.read();
  await receiverPromise;

  assert.deepEqual(new Uint8Array(decryptedFrame.data), originalPlaintext, 'Receiver decrypts back to original payload');
});

test('ForwardingBridge pipes encoded streams from source to child without decrypting', async () => {
  const bridge = new ForwardingBridge();

  const mockEncryptedChunks = [
    { type: 'delta', timestamp: 100, data: new Uint8Array([0x01, 0x02, 0x03]).buffer },
    { type: 'delta', timestamp: 120, data: new Uint8Array([0x04, 0x05, 0x06]).buffer }
  ];

  const receivedByChild = [];

  // Mock readable stream from incoming receiver
  let controller;
  const readable = new ReadableStream({
    start(c) {
      controller = c;
    }
  });

  // Mock writable stream to outgoing child sender
  const writable = new WritableStream({
    write(chunk) {
      receivedByChild.push(chunk);
    }
  });

  bridge.pipeEncodedStream('source-video-1', 'child-peer-2', { readable, writable });

  // Simulate pushing incoming encoded frames
  controller.enqueue(mockEncryptedChunks[0]);
  controller.enqueue(mockEncryptedChunks[1]);
  controller.close();

  // Allow streams to flush
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(receivedByChild.length, 2);
  assert.equal(receivedByChild[0].timestamp, 100);
  assert.equal(receivedByChild[1].timestamp, 120);

  // Stop pipe
  bridge.stopEncodedPipe('source-video-1', 'child-peer-2');
  assert.equal(bridge.isPipeActive('source-video-1', 'child-peer-2'), false);
});
