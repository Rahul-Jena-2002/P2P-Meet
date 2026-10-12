import test from 'node:test';
import assert from 'node:assert/strict';
import { DataChannelManager } from '../src/core/data/DataChannelManager.js';

class MockDataChannel {
  constructor(label = 'data') {
    this.label = label;
    this.readyState = 'open';
    this.sentMessages = [];
    this.bufferedAmount = 0;
    this.onmessage = null;
    this.onbufferedamountlow = null;
    this.bufferedAmountLowThreshold = 0;
  }

  send(data) {
    this.sentMessages.push(data);
  }
}

test('DataChannelManager routes chat and whiteboard messages to handlers', () => {
  const dcm = new DataChannelManager();
  const mockDc = new MockDataChannel();
  dcm.attachChannel('peer-1', mockDc);

  let chatReceived = null;
  let boardReceived = null;

  dcm.on('chat', (data) => { chatReceived = data; });
  dcm.on('whiteboard', (data) => { boardReceived = data; });

  // Simulate incoming messages on mockDc
  mockDc.onmessage({
    data: JSON.stringify({ type: 'chat', text: 'Hello P2P' })
  });
  assert.deepEqual(chatReceived, { type: 'chat', text: 'Hello P2P' });

  mockDc.onmessage({
    data: JSON.stringify({ type: 'whiteboard', stroke: [1, 2, 3] })
  });
  assert.deepEqual(boardReceived, { type: 'whiteboard', stroke: [1, 2, 3] });
});

test('DataChannelManager transfers raw file bytes in chunks and reassembles a Blob', async () => {
  const dcm = new DataChannelManager({ chunkSize: 16 });
  const mockDc = new MockDataChannel();
  dcm.attachChannel('peer-1', mockDc);

  const filePayload = new TextEncoder().encode('1234567890abcdefghijklmnopqrstuvwxyz');
  const file = new Blob([filePayload], { type: 'text/plain' });
  Object.defineProperty(file, 'name', { value: 'test.txt' });
  await dcm.sendFile('peer-1', file);

  assert.equal(mockDc.sentMessages.length, 3);
  assert.ok(mockDc.sentMessages.every(packet => packet instanceof ArrayBuffer));
  const firstPacket = new Uint8Array(mockDc.sentMessages[0]);
  assert.deepEqual(Array.from(firstPacket.subarray(0, 4)), [0x50, 0x32, 0x50, 0x46]);
  const headerSize = new DataView(firstPacket.buffer).getUint32(4);
  const firstHeader = JSON.parse(new TextDecoder().decode(firstPacket.subarray(8, 8 + headerSize)));
  assert.equal(firstHeader.name, 'test.txt');
  assert.equal(firstHeader.chunkIndex, 0);

  const receiverDcm = new DataChannelManager();
  let completedFile = null;
  receiverDcm.on('fileComplete', (file) => {
    completedFile = file;
  });

  const receiverDc = new MockDataChannel();
  receiverDcm.attachChannel('sender-1', receiverDc);

  for (const raw of mockDc.sentMessages) {
    receiverDc.onmessage({ data: raw });
  }

  assert.ok(completedFile);
  assert.equal(completedFile.peerId, 'sender-1');
  assert.equal(completedFile.name, 'test.txt');
  assert.equal(completedFile.size, filePayload.length);
  assert.deepEqual(new Uint8Array(await completedFile.blob.arrayBuffer()), filePayload);
});

test('DataChannelManager sends zero-byte files and rejects a missing peer connection', async () => {
  const dcm = new DataChannelManager();
  const channel = new MockDataChannel();
  dcm.attachChannel('peer-1', channel);
  const empty = new Blob([]);
  Object.defineProperty(empty, 'name', { value: 'empty.txt' });
  await dcm.sendFile('peer-1', empty);
  assert.equal(channel.sentMessages.length, 1);

  await assert.rejects(
    dcm.sendFile('not-connected', empty),
    /not connected for direct file sharing/,
  );
});
