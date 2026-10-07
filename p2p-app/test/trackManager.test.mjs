import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackManager } from '../src/core/media/TrackManager.js';

class MockTrack {
  constructor({ kind, id = `track-${Math.random()}` } = {}) {
    this.kind = kind;
    this.id = id;
    this.enabled = true;
    this.contentHint = '';
    this.listeners = new Map();
  }

  addEventListener(ev, fn) {
    if (!this.listeners.has(ev)) this.listeners.set(ev, new Set());
    this.listeners.get(ev).add(fn);
  }

  removeEventListener(ev, fn) {
    this.listeners.get(ev)?.delete(fn);
  }

  emit(ev, data) {
    this.listeners.get(ev)?.forEach((fn) => fn(data));
  }
}

class MockRTC {
  constructor() {
    this.slots = { audio: null, video: null, screen: null };
  }

  async setLocalTrack(slot, track) {
    this.slots[slot] = track;
  }
}

test('TrackManager sourceId generation and parsing', () => {
  const tm = new TrackManager({ userId: 'user-rahul' });
  const camSourceId = tm.createSourceId('user-rahul', 'camera');
  assert.equal(camSourceId, 'user-rahul:camera');

  const parsed = tm.parseSourceId(camSourceId);
  assert.deepEqual(parsed, { publisherId: 'user-rahul', type: 'camera' });

  assert.equal(tm.parseSourceId('invalid'), null);
});

test('TrackManager manages local camera, screen, and audio tracks', async () => {
  const rtc = new MockRTC();
  const tm = new TrackManager({ userId: 'user-rahul', rtc });

  const mic = new MockTrack({ kind: 'audio', id: 'mic-1' });
  const cam = new MockTrack({ kind: 'video', id: 'cam-1' });
  const screen = new MockTrack({ kind: 'video', id: 'screen-1' });

  await tm.setLocalAudioTrack(mic);
  await tm.setLocalCameraTrack(cam);
  await tm.setLocalScreenTrack(screen);

  assert.equal(rtc.slots.audio.id, 'mic-1');
  assert.equal(rtc.slots.video.id, 'cam-1');
  assert.equal(rtc.slots.screen.id, 'screen-1');
  assert.equal(cam.contentHint, 'motion');
  assert.equal(screen.contentHint, 'detail');

  const all = tm.getAllSources();
  assert.equal(all.length, 3);
  assert.ok(tm.getSource('user-rahul:camera'));
  assert.ok(tm.getSource('user-rahul:screen'));
  assert.ok(tm.getSource('user-rahul:audio'));

  // Stopping screen share clears only screen source
  await tm.setLocalScreenTrack(null);
  assert.equal(rtc.slots.screen, null);
  assert.equal(rtc.slots.video.id, 'cam-1'); // camera remains active
  assert.equal(tm.getSource('user-rahul:screen'), null);
  assert.equal(tm.getSource('user-rahul:camera').track.id, 'cam-1');
});

test('TrackManager handles native screen track onended event', async () => {
  const rtc = new MockRTC();
  const tm = new TrackManager({ userId: 'user-rahul', rtc });

  const screen = new MockTrack({ kind: 'video', id: 'screen-2' });
  let screenEndedFired = false;
  tm.on('screenEnded', () => {
    screenEndedFired = true;
  });

  await tm.setLocalScreenTrack(screen);
  assert.ok(tm.getSource('user-rahul:screen'));

  // Simulate user pressing browser native "Stop Sharing" button
  screen.emit('ended');
  // Allow async handler to run
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(screenEndedFired, true);
  assert.equal(tm.getSource('user-rahul:screen'), null);
  assert.equal(rtc.slots.screen, null);
});

test('TrackManager registers and unregisters remote peer sources', () => {
  const tm = new TrackManager({ userId: 'local-user' });

  const remoteCam = new MockTrack({ kind: 'video', id: 'rcam-1' });
  const remoteScreen = new MockTrack({ kind: 'video', id: 'rscreen-1' });

  tm.registerRemoteTrack({ peerId: 'peer-sravya', track: remoteCam, isScreen: false });
  tm.registerRemoteTrack({ peerId: 'peer-sravya', track: remoteScreen, isScreen: true });

  const sravyaSources = tm.getSourcesByPeer('peer-sravya');
  assert.equal(sravyaSources.length, 2);
  assert.ok(tm.getSource('peer-sravya:camera'));
  assert.ok(tm.getSource('peer-sravya:screen'));

  // When sravya leaves, clean up her sources
  tm.unregisterPeerSources('peer-sravya');
  assert.equal(tm.getSourcesByPeer('peer-sravya').length, 0);
  assert.equal(tm.getSource('peer-sravya:camera'), null);
  assert.equal(tm.getSource('peer-sravya:screen'), null);
});
