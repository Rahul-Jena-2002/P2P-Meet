import test from 'node:test';
import assert from 'node:assert/strict';
import { TopologyManager, MeshStrategy } from '../src/core/topology/TopologyManager.js';

test('MeshStrategy instructs connection for all peers up to room capacity', () => {
  const strategy = new MeshStrategy({ maxFullMeshPeers: 12 });
  const localUser = { id: 'user-me', isPublishing: true };

  assert.equal(strategy.shouldConnect(localUser, { id: 'peer-1', isPublishing: true }, 5), true);
  assert.equal(strategy.shouldConnect(localUser, { id: 'peer-2', isPublishing: false }, 5), true);
});

test('TopologyManager coordinates peer addition through its strategy', () => {
  const connectionsCreated = [];
  const mockRtc = {
    createPeer: (id) => { connectionsCreated.push(id); }
  };

  const tm = new TopologyManager({
    localUserId: 'user-me',
    rtc: mockRtc,
    strategy: new MeshStrategy()
  });

  tm.evaluatePeer({ id: 'peer-alice', isPublishing: true });
  assert.equal(connectionsCreated.length, 1);
  assert.equal(connectionsCreated[0], 'peer-alice');
});
