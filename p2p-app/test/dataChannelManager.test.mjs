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

test('DataChannelManager chunks files and handles reassembly with backpressure check', async () => {
  const dcm = new DataChannelManager({ chunkSize: 16 }); // small chunk size for testing
  const mockDc = new MockDataChannel();
  dcm.attachChannel('peer-1', mockDc);

  const filePayload = '1234567890abcdefghijklmnopqrstuvwxyz'; // 36 chars > 16

  await dcm.sendFile('peer-1', {
    fileId: 'f-1',
    name: 'test.txt',
    size: filePayload.length,
    data: filePayload
  });

  // Verify chunks were sent
  assert.ok(mockDc.sentMessages.length >= 3); // 36 / 16 = 3 chunks
  const firstChunk = JSON.parse(mockDc.sentMessages[0]);
  assert.equal(firstChunk.type, 'file-chunk');
  assert.equal(firstChunk.fileId, 'f-1');
  assert.equal(firstChunk.chunkIndex, 0);

  // Now simulate receiver side reassembly
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
  assert.equal(completedFile.fileId, 'f-1');
  assert.equal(completedFile.data, filePayload);
});
