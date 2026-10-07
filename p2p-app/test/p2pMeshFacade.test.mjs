import test from 'node:test';
import assert from 'node:assert/strict';
import { P2PMesh } from '../src/lib/p2pMesh.js';

test('P2PMesh facade instantiates cleanly and delegates to core MeetingController', () => {
  let joinedUser = null;
  const mesh = new P2PMesh({
    roomId: 'FACADEROOM',
    userId: 'user-facade',
    userName: 'FacadeUser',
    onPeerJoin: (id, name) => { joinedUser = { id, name }; }
  });

  assert.equal(mesh.roomId, 'FACADEROOM');
  assert.equal(mesh.userId, 'user-facade');
  assert.equal(typeof mesh.connect, 'function');
  assert.equal(typeof mesh.broadcast, 'function');
  assert.equal(typeof mesh.replaceStream, 'function');
  assert.equal(typeof mesh.destroy, 'function');

  mesh.signaling.emit('peer-joined', { userId: 'peer-a', userName: 'Peer A' });
  assert.deepEqual(joinedUser, { id: 'peer-a', name: 'Peer A' });

  mesh.destroy();
});
