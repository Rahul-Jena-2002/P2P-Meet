import test from 'node:test';
import assert from 'node:assert/strict';
import { QualityController } from '../src/core/quality/QualityController.js';

test('QualityController computes metrics from RTCStatsReport', async () => {
  const mockReports = new Map([
    ['pair-1', {
      type: 'candidate-pair',
      state: 'succeeded',
      currentRoundTripTime: 0.045 // 45ms
    }],
    ['inbound-video', {
      type: 'remote-inbound-rtp',
      kind: 'video',
      packetsLost: 2,
      packetsReceived: 98,
      roundTripTime: 0.042
    }]
  ]);

  const mockPc = {
    connectionState: 'connected',
    getStats: async () => mockReports
  };

  const qc = new QualityController({
    getPeers: () => [{ id: 'peer-1', pc: mockPc }]
  });

  const stats = await qc.sample();

  assert.equal(stats.rtt, 44); // (45 + 42) / 2 = 43.5 -> 44ms
  assert.equal(stats.lossRate, 2.0); // 2%
  assert.equal(stats.quality, 'excellent');
  assert.equal(stats.activePeers, 1);
});

test('QualityController adapts quality rating on high latency or packet loss', async () => {
  const mockReports = new Map([
    ['pair-1', {
      type: 'candidate-pair',
      state: 'succeeded',
      currentRoundTripTime: 0.350 // 350ms
    }],
    ['inbound-video', {
      type: 'remote-inbound-rtp',
      kind: 'video',
      packetsLost: 15,
      packetsReceived: 85
    }]
  ]);

  const qc = new QualityController({
    getPeers: () => [{ id: 'peer-1', pc: { connectionState: 'connected', getStats: async () => mockReports } }]
  });

  const stats = await qc.sample();
  assert.equal(stats.quality, 'poor');
  assert.ok(stats.scaleFactor > 1.0); // suggests downscaling
});
