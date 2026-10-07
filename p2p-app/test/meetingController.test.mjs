import test from 'node:test';
import assert from 'node:assert/strict';
import { MeetingController } from '../src/core/meeting/MeetingController.js';

class MockSignalingClient {
  constructor() {
    this.listeners = new Map();
    this.sentSignals = [];
    this.broadcasts = [];
  }
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
  }
  emit(event, data) {
    const fns = this.listeners.get(event);
    if (fns) fns.forEach(fn => fn(data));
  }
  sendSignal(targetId, signalData) {
    this.sentSignals.push({ targetId, signalData });
  }
  broadcast(payload) {
    this.broadcasts.push(payload);
  }
  connect() {}
  disconnect() {}
}

class MockPeerConnectionManager {
  constructor() {
    this.listeners = new Map();
    this.offersCreated = [];
    this.answersHandled = [];
    this.candidatesHandled = [];
    this.peersRemoved = [];
    this.sentData = [];
    this.replacedTracks = [];
  }
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
  }
  emit(event, data) {
    const fns = this.listeners.get(event);
    if (fns) fns.forEach(fn => fn(data));
  }
  async createOffer(peerId) {
    this.offersCreated.push(peerId);
    return { type: 'offer', sdp: 'test-offer' };
  }
  async handleAnswer(peerId, answer) {
    this.answersHandled.push({ peerId, answer });
  }
  async handleCandidate(peerId, candidate) {
    this.candidatesHandled.push({ peerId, candidate });
  }
  async replaceTracks(args) {
    this.replacedTracks.push(args);
  }
  sendData(data) {
    this.sentData.push(data);
  }
  removePeer(peerId) {
    this.peersRemoved.push(peerId);
  }
  destroy() {}
}

test('MeetingController coordinates offer signaling when peer joins', async () => {
  const signaling = new MockSignalingClient();
  const rtc = new MockPeerConnectionManager();

  const controller = new MeetingController({
    roomId: 'TESTROOM',
    userId: 'user-me',
    userName: 'Me',
    signaling,
    rtc
  });

  await controller.join();

  // Simulate a peer joining the room
  signaling.emit('peer-joined', { userId: 'user-bob', userName: 'Bob' });
  await new Promise(resolve => setTimeout(resolve, 10));

  // Verify controller instructed rtc to create offer
  assert.equal(rtc.offersCreated.length, 1);
  assert.equal(rtc.offersCreated[0], 'user-bob');

  // Verify controller sent the offer via signaling
  assert.equal(signaling.sentSignals.length, 1);
  assert.equal(signaling.sentSignals[0].targetId, 'user-bob');
  assert.equal(signaling.sentSignals[0].signalData.type, 'offer');
});

test('MeetingController dispatches ICE candidates to signaling', () => {
  const signaling = new MockSignalingClient();
  const rtc = new MockPeerConnectionManager();

  const controller = new MeetingController({
    roomId: 'TESTROOM',
    userId: 'user-me',
    userName: 'Me',
    signaling,
    rtc
  });

  // RTC emits an iceCandidate event
  rtc.emit('iceCandidate', { peerId: 'user-bob', candidate: { candidate: 'cand-1' } });

  assert.equal(signaling.sentSignals.length, 1);
  assert.equal(signaling.sentSignals[0].targetId, 'user-bob');
  assert.equal(signaling.sentSignals[0].signalData.type, 'candidate');
});

test('MeetingController broadcast sends payload over both signaling and RTC data channel', () => {
  const signaling = new MockSignalingClient();
  const rtc = new MockPeerConnectionManager();

  const controller = new MeetingController({
    roomId: 'TESTROOM',
    userId: 'user-me',
    userName: 'Me',
    signaling,
    rtc
  });

  controller.broadcast({ type: 'reaction', emoji: '🎉' });

  assert.equal(signaling.broadcasts.length, 1);
  assert.equal(signaling.broadcasts[0].type, 'reaction');
  assert.equal(rtc.sentData.length, 1);
  assert.equal(rtc.sentData[0].type, 'reaction');
});

test('MeetingController replaceStream extracts tracks and updates RTC', async () => {
  const signaling = new MockSignalingClient();
  const rtc = new MockPeerConnectionManager();

  const controller = new MeetingController({
    roomId: 'TESTROOM',
    userId: 'user-me',
    userName: 'Me',
    signaling,
    rtc
  });

  const mockAudioTrack = { kind: 'audio', id: 'audio-track-1' };
  const mockVideoTrack = { kind: 'video', id: 'video-track-1' };
  const mockStream = {
    getAudioTracks: () => [mockAudioTrack],
    getVideoTracks: () => [mockVideoTrack]
  };

  await controller.replaceStream(mockStream, true);

  assert.equal(rtc.replacedTracks.length, 1);
  assert.equal(rtc.replacedTracks[0].audioTrack, mockAudioTrack);
  assert.equal(rtc.replacedTracks[0].videoTrack, mockVideoTrack);
  assert.equal(rtc.replacedTracks[0].isScreenSharing, true);
});

test('MeetingController supports legacy callback props (onPeerJoin, onData)', () => {
  const signaling = new MockSignalingClient();
  const rtc = new MockPeerConnectionManager();

  let joinedPeer = null;
  let receivedData = null;

  const controller = new MeetingController({
    roomId: 'TESTROOM',
    userId: 'user-me',
    userName: 'Me',
    signaling,
    rtc,
    onPeerJoin: (id, name) => { joinedPeer = { id, name }; },
    onData: (data) => { receivedData = data; }
  });

  signaling.emit('peer-joined', { userId: 'alice-1', userName: 'Alice' });
  assert.deepEqual(joinedPeer, { id: 'alice-1', name: 'Alice' });

  rtc.emit('dataMessage', { peerId: 'alice-1', data: { type: 'chat', text: 'hi' } });
  assert.deepEqual(receivedData, { type: 'chat', text: 'hi' });
});

test('MeetingController integrates QualityController and DataChannelManager', () => {
  const signaling = new MockSignalingClient();
  const rtc = new MockPeerConnectionManager();

  const controller = new MeetingController({
    roomId: 'TESTROOM',
    userId: 'user-me',
    userName: 'Me',
    signaling,
    rtc
  });

  assert.ok(controller.quality);
  assert.ok(controller.dataChannels);
  assert.ok(controller.topology);
});



