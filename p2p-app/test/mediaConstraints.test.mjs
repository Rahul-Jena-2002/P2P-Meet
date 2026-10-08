import test from 'node:test';
import assert from 'node:assert/strict';
import { SubscriptionManager } from '../src/core/topology/SubscriptionManager.js';
import { MediaManager } from '../src/core/media/MediaManager.js';

test('MediaManager provides 3-layer simulcast configuration and differentiated audio constraints', () => {
  const media = new MediaManager();

  const encodings = media.getSimulcastEncodings();
  assert.equal(encodings.length, 3, 'Simulcast must provide exactly 3 spatial layers');
  assert.equal(encodings[0].rid, 'q'); // quarter
  assert.equal(encodings[1].rid, 'h'); // half
  assert.equal(encodings[2].rid, 'f'); // full
  assert.ok(encodings[0].maxBitrate <= 200000);
  assert.ok(encodings[2].maxBitrate >= 1000000);

  const micConstraints = media.getMicAudioConstraints();
  assert.equal(micConstraints.channelCount, 1, 'Mic audio must be mono for bandwidth efficiency');
  assert.equal(micConstraints.echoCancellation, true);

  const screenAudioConstraints = media.getScreenAudioConstraints();
  assert.equal(screenAudioConstraints.channelCount, 2, 'Screen audio must be stereo for high-fidelity audio');
  assert.equal(screenAudioConstraints.echoCancellation, false, 'DSP must be disabled for screen audio');
});

test('SubscriptionManager generates SUBSCRIBE(layer) control messages for visible and hidden tiles', () => {
  const subManager = new SubscriptionManager({
    localUserId: 'user-local',
    maxVisibleCards: 2
  });

  const controlMessages = [];
  subManager.on('subscribeControl', (msg) => {
    controlMessages.push(msg);
  });

  const sources = [
    { sourceId: 'src-1', publisherId: 'user-alice', type: 'camera' },
    { sourceId: 'src-2', publisherId: 'user-bob', type: 'camera' },
    { sourceId: 'src-3', publisherId: 'user-charlie', type: 'camera' }
  ];

  // Pin Alice to stage (layer 2)
  subManager.setPinnedSource('src-1');
  subManager.evaluateSubscriptions(sources);

  // src-1 is pinned (layer 2)
  // src-2 is visible (layer 1)
  // src-3 is beyond maxVisibleCards=2 -> hidden tile (layer 0)
  const src1Msg = controlMessages.find((m) => m.sourceId === 'src-1');
  const src2Msg = controlMessages.find((m) => m.sourceId === 'src-2');
  const src3Msg = controlMessages.find((m) => m.sourceId === 'src-3');

  assert.ok(src1Msg, 'Control message emitted for src-1');
  assert.equal(src1Msg.layer, 2, 'Pinned stage video should request layer 2');

  assert.ok(src2Msg, 'Control message emitted for src-2');
  assert.equal(src2Msg.layer, 1, 'Visible video should request layer 1');

  assert.ok(src3Msg, 'Control message emitted for hidden tile src-3');
  assert.equal(src3Msg.layer, 0, 'Hidden tile should request layer 0 to pause upstream transmission');
});
