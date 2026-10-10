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

test('MediaManager requests screen share with zero latency and raw audio constraints', async () => {
  let capturedConstraints = null;
  const mockNavigator = {
    mediaDevices: {
      getDisplayMedia: async (constraints) => {
        capturedConstraints = constraints;
        return {
          getVideoTracks: () => [{ id: 'screen-video', stop: () => {} }],
          getAudioTracks: () => [{ id: 'screen-audio', stop: () => {} }],
          getTracks: () => [{ id: 'screen-video', stop: () => {} }, { id: 'screen-audio', stop: () => {} }]
        };
      }
    }
  };
  const manager = new MediaManager({ navigator: mockNavigator });
  await manager.startScreenShare({ audio: true });
  assert.deepStrictEqual(capturedConstraints.audio, {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    latency: 0
  });
  assert.equal(manager.getLocalScreenAudioTrack().id, 'screen-audio');
});

test('startScreenShare enforces 1080p minimum ideal resolution, 4k max, and applies contentHint detail', async () => {
  let capturedConstraints = null;
  const mockTrack = {
    kind: 'video',
    id: 'screen-video-highres',
    contentHint: '',
    stop: () => {}
  };
  const mockNavigator = {
    mediaDevices: {
      getDisplayMedia: async (constraints) => {
        capturedConstraints = constraints;
        return {
          getVideoTracks: () => [mockTrack],
          getAudioTracks: () => [],
          getTracks: () => [mockTrack]
        };
      }
    }
  };

  const manager = new MediaManager({ navigator: mockNavigator });
  await manager.startScreenShare({ audio: false });

  assert.strictEqual(capturedConstraints.video.width.ideal, 1920);
  assert.strictEqual(capturedConstraints.video.width.max, 3840);
  assert.strictEqual(capturedConstraints.video.height.ideal, 1080);
  assert.strictEqual(capturedConstraints.video.height.max, 2160);
  assert.strictEqual(mockTrack.contentHint, 'detail');
});
