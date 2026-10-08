import test from 'node:test';
import assert from 'node:assert/strict';
import { ForwardingBridge } from '../src/core/rtc/ForwardingBridge.js';
import { FailureDetector } from '../src/core/topology/FailureDetector.js';
import { Rebalancer } from '../src/core/topology/Rebalancer.js';
import { OverlayManager } from '../src/core/topology/OverlayManager.js';
import { RelaySelector } from '../src/core/topology/RelaySelector.js';

class MockChildPC {
  constructor() {
    this.tracks = [];
  }

  addTrack(track, stream) {
    const sender = {
      track,
      replaceTrack: async (newTrack) => {
        sender.track = newTrack;
      }
    };
    this.tracks.push({ track, stream, sender });
    return sender;
  }
}

test('ForwardingBridge attaches incoming track to child RTCPeerConnection and cleans up', async () => {
  const childPc = new MockChildPC();
  const mockTrack = { kind: 'video', id: 'screen-forward-1' };

  const trackManager = {
    getSource: (id) => (id === 'rahul:screen' ? { sourceId: id, track: mockTrack } : null)
  };

  const rtc = {
    getPeer: (id) => (id === 'child-user-1' ? { peerId: id, pc: childPc } : null)
  };

  const bridge = new ForwardingBridge({ trackManager, rtc });

  // 1. Forward track to child-user-1
  const record = await bridge.forwardTrack('rahul:screen', 'child-user-1');
  assert.ok(record);
  assert.equal(childPc.tracks.length, 1);
  assert.equal(childPc.tracks[0].track.id, 'screen-forward-1');

  // 2. Stop forwarding replaces track with null
  await bridge.stopForwarding('rahul:screen', 'child-user-1');
  assert.equal(record.sender.track, null);
});

test('FailureDetector detects heartbeats and emits nodeFailed on timeout or connection error', async () => {
  const detector = new FailureDetector({ heartbeatTimeoutMs: 20 });

  let failedNode = null;
  detector.on('nodeFailed', (ev) => {
    failedNode = ev;
  });

  // Test immediate failure on failed connection state
  detector.reportConnectionState('peer-stalled', 'failed');
  assert.ok(failedNode);
  assert.equal(failedNode.peerId, 'peer-stalled');
  assert.equal(failedNode.reason, 'connection-failed');

  // Test timeout
  failedNode = null;
  detector.recordHeartbeat('peer-timeout');
  await new Promise((r) => setTimeout(r, 30));
  detector.checkHealth();

  assert.ok(failedNode);
  assert.equal(failedNode.peerId, 'peer-timeout');
  assert.equal(failedNode.reason, 'heartbeat-timeout');
});

test('Rebalancer reparents orphan sources to replacement relay upon parent node failure', () => {
  const localUserId = 'student-subscriber';
  const overlay = new OverlayManager({ localUserId });
  const selector = new RelaySelector();

  // Setup candidate replacement relay
  selector.updatePeerCapacity('relay-backup', {
    measuredUploadBps: 20_000_000,
    deviceType: 'desktop',
    avgRttMs: 20
  });

  // Assign initial route: publisher -> relay-failed -> student-subscriber
  overlay.assignRelay({
    sourceId: 'rahul:screen',
    parentPeerId: 'relay-failed',
    childPeerId: localUserId
  });

  assert.equal(overlay.getUpstreamParent('rahul:screen'), 'relay-failed');

  // Rebalance upon relay-failed failure
  const rebalancer = new Rebalancer({
    overlayManager: overlay,
    relaySelector: selector,
    localUserId
  });

  let migrationEvent = null;
  rebalancer.on('reparentCompleted', (ev) => {
    migrationEvent = ev;
  });

  const migrations = rebalancer.handleNodeFailure('relay-failed');
  assert.equal(migrations.length, 1);
  assert.equal(migrations[0].newParentId, 'relay-backup');
  assert.equal(overlay.getUpstreamParent('rahul:screen'), 'relay-backup');
  assert.ok(migrationEvent);
});

test('MeetingController wires ForwardingBridge to forward remote tracks when instructed by topology', async () => {
  const { MeetingController } = await import('../src/core/meeting/MeetingController.js');
  const controller = new MeetingController({ roomId: 'ROOM1', userId: 'supernode-1' });
  let forwarded = false;
  controller.forwardingBridge = {
    forwardTrack: (sourceId, targetId) => {
      forwarded = true;
      assert.strictEqual(sourceId, 'peer-a:video');
      assert.strictEqual(targetId, 'peer-b');
    }
  };
  controller.handleForwardInstruction({ sourceId: 'peer-a:video', targetPeerId: 'peer-b' });
  assert.strictEqual(forwarded, true);
  controller.destroy();
});
