import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaManager } from '../src/core/media/MediaManager.js';

test('MediaManager handles track state toggling cleanly', () => {
  const manager = new MediaManager();

  let audioTrackEnabled = true;
  let videoTrackEnabled = true;
  let audioStopped = false;
  let videoStopped = false;

  const mockStream = {
    getAudioTracks: () => [{
      kind: 'audio',
      get enabled() { return audioTrackEnabled; },
      set enabled(val) { audioTrackEnabled = val; },
      stop: () => { audioStopped = true; }
    }],
    getVideoTracks: () => [{
      kind: 'video',
      get enabled() { return videoTrackEnabled; },
      set enabled(val) { videoTrackEnabled = val; },
      stop: () => { videoStopped = true; }
    }],
    getTracks: function() {
      return [...this.getAudioTracks(), ...this.getVideoTracks()];
    }
  };

  manager.setStream(mockStream);
  assert.equal(manager.isAudioEnabled, true);
  assert.equal(manager.isVideoEnabled, true);

  // Toggle audio off
  const nextAudio = manager.setAudioEnabled(false);
  assert.equal(nextAudio, false);
  assert.equal(audioTrackEnabled, false);
  assert.equal(manager.isAudioEnabled, false);

  // Toggle video off
  const nextVideo = manager.setVideoEnabled(false);
  assert.equal(nextVideo, false);
  assert.equal(videoTrackEnabled, false);
  assert.equal(manager.isVideoEnabled, false);

  // Cleanup
  manager.stop();
  assert.equal(audioStopped, true);
  assert.equal(videoStopped, true);
});

test('MediaManager categorizes device list correctly', async () => {
  const mockDevices = [
    { kind: 'videoinput', deviceId: 'cam-1', label: 'Facecam' },
    { kind: 'audioinput', deviceId: 'mic-1', label: 'USB Mic' },
    { kind: 'audiooutput', deviceId: 'spk-1', label: 'Headphones' },
    { kind: 'audiooutput', deviceId: 'spk-2', label: 'Speakers' },
  ];

  const manager = new MediaManager({
    deviceEnumerator: async () => mockDevices
  });

  const categorized = await manager.getDevices();
  assert.equal(categorized.video.length, 1);
  assert.equal(categorized.audio.length, 1);
  assert.equal(categorized.audioOutput.length, 2);
  assert.equal(categorized.video[0].deviceId, 'cam-1');
  assert.equal(categorized.audio[0].deviceId, 'mic-1');
});
