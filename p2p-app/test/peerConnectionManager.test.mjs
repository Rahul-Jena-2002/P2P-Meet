import test from 'node:test';
import assert from 'node:assert/strict';
import { PeerConnectionManager } from '../src/core/rtc/PeerConnectionManager.js';

class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceCandidates = [];
    this.tracks = [];
    this.signalingState = 'stable';
    this.connectionState = 'new';
    this.onicecandidate = null;
    this.ontrack = null;
    this.ondatachannel = null;
    this.onconnectionstatechange = null;
    this.closed = false;
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

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
  }

  async createOffer() {
    return { type: 'offer', sdp: 'mock-offer-sdp' };
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'mock-answer-sdp' };
  }

  async addIceCandidate(candidate) {
    this.iceCandidates.push(candidate);
  }

  getSenders() {
    return this.tracks.map(({ track }) => ({
      track,
      replaceTrack: async (newTrack) => {
        track = newTrack;
        return true;
      }
    }));
  }

  createDataChannel(label) {
    return { label, readyState: 'open', send: () => {} };
  }

  close() {
    this.closed = true;
    this.connectionState = 'closed';
  }
}

test('PeerConnectionManager buffers ICE candidates until remoteDescription is set', async () => {
  const manager = new PeerConnectionManager({
    peerConnectionFactory: (config) => new MockRTCPeerConnection(config)
  });

  const peerId = 'peer-123';
  manager.createPeer(peerId);

  // Send candidate before remote description
  await manager.handleCandidate(peerId, { candidate: 'candidate-1' });

  const peer = manager.getPeer(peerId);
  assert.equal(peer.pendingCandidates.length, 1);
  assert.equal(peer.pc.iceCandidates.length, 0);

  // Set remote description
  await manager.handleOffer(peerId, { type: 'offer', sdp: 'mock-sdp' });

  // Now the pending candidate should be drained
  assert.equal(peer.pendingCandidates.length, 0);
  assert.equal(peer.pc.iceCandidates.length, 1);
  assert.equal(peer.pc.iceCandidates[0].candidate, 'candidate-1');
});

test('PeerConnectionManager removes peer and releases connection cleanly', () => {
  const manager = new PeerConnectionManager({
    peerConnectionFactory: (config) => new MockRTCPeerConnection(config)
  });

  const peerId = 'peer-456';
  manager.createPeer(peerId);
  const peer = manager.getPeer(peerId);
  assert.ok(peer);

  manager.removePeer(peerId);
  assert.equal(peer.pc.closed, true);
  assert.equal(manager.getPeer(peerId), undefined);
});

test('PeerConnectionManager replaceTracks updates senders across all peers', async () => {
  const manager = new PeerConnectionManager({
    peerConnectionFactory: (config) => new MockRTCPeerConnection(config)
  });

  const peerId = 'peer-789';
  const peer = manager.createPeer(peerId);

  const initialAudio = { kind: 'audio', id: 'audio-1' };
  const initialVideo = { kind: 'video', id: 'video-1' };
  manager.addTrack(initialAudio);
  manager.addTrack(initialVideo);

  const newAudio = { kind: 'audio', id: 'audio-2' };
  const newVideo = { kind: 'video', id: 'video-2' };

  await manager.replaceTracks({ audioTrack: newAudio, videoTrack: newVideo });
  const senders = peer.pc.getSenders();
  assert.equal(senders.length, 2);
});

test('PeerConnectionManager perfect negotiation handles offer collision (glare)', async () => {
  const manager = new PeerConnectionManager({
    myId: 'user-impolite',
    peerConnectionFactory: (config) => new MockRTCPeerConnection(config)
  });

  const peerId = 'user-polite';
  const peer = manager.createPeer(peerId, false, false); // polite = false (impolite)
  peer.makingOffer = true;
  peer.signalingState = 'have-local-offer';

  // Impolite peer receiving offer during collision should ignore offer and return null
  const answerFromImpolite = await manager.handleOffer(peerId, { type: 'offer', sdp: 'colliding-offer' });
  assert.equal(answerFromImpolite, null);
  assert.equal(peer.ignoreOffer, true);

  // Polite peer
  const politeManager = new PeerConnectionManager({
    myId: 'user-polite',
    peerConnectionFactory: (config) => new MockRTCPeerConnection(config)
  });
  const politePeer = politeManager.createPeer('user-impolite', false, true); // polite = true
  politePeer.makingOffer = true;
  politePeer.signalingState = 'have-local-offer';

  const answerFromPolite = await politeManager.handleOffer('user-impolite', { type: 'offer', sdp: 'colliding-offer' });
  assert.ok(answerFromPolite); // accepted and generated answer
  assert.equal(politePeer.ignoreOffer, false);
});



test('tracks published before a peer exists are attached when the peer is created', async () => {
  const manager = new PeerConnectionManager({ peerConnectionFactory: (c) => new MockRTCPeerConnection(c) });
  await manager.replaceTracks({ audioTrack: { kind: 'audio' }, videoTrack: { kind: 'video' } });
  const peer = manager.createPeer('late-peer');
  assert.deepEqual(peer.pc.tracks.map((t) => t.track.kind), ['audio', 'video']);
});

test('track added after peer exists is attached and replace never crosses kinds', async () => {
  const manager = new PeerConnectionManager({ peerConnectionFactory: (c) => new MockRTCPeerConnection(c) });
  const peer = manager.createPeer('p');
  await manager.replaceTracks({ audioTrack: { kind: 'audio', id: 'a1' } });
  assert.equal(peer.pc.tracks.length, 1);
  await manager.replaceTracks({ videoTrack: { kind: 'video', id: 'v1' } });
  assert.equal(peer.pc.tracks.length, 2);
  assert.equal(manager.local.audio.id, 'a1');
});

test('negotiationneeded sends an offer signal', async () => {
  const manager = new PeerConnectionManager({ peerConnectionFactory: (c) => new MockRTCPeerConnection(c) });
  const peer = manager.createPeer('p');
  const signals = [];
  manager.on('signal', (s) => signals.push(s));
  await peer.pc.onnegotiationneeded();
  assert.equal(signals[0].msg.type, 'offer');
});

test('PeerConnectionManager supports dual video transceivers (camera and screen simultaneously)', async () => {
  const manager = new PeerConnectionManager({ peerConnectionFactory: (c) => new MockRTCPeerConnection(c) });
  const peer = manager.createPeer('peer-dual');

  const mic = { kind: 'audio', id: 'mic-1' };
  const cam = { kind: 'video', id: 'cam-1' };
  const screen = { kind: 'video', id: 'screen-1' };

  await manager.replaceTracks({ audioTrack: mic, videoTrack: cam, screenTrack: screen });

  assert.equal(peer.senders.audio.track.id, 'mic-1');
  assert.equal(peer.senders.video.track.id, 'cam-1');
  assert.equal(peer.senders.screen.track.id, 'screen-1');
  assert.equal(peer.pc.tracks.length, 3);

  // Stopping screen share should replace screenTrack with null without affecting camera
  await manager.replaceTracks({ screenTrack: null });
  assert.equal(peer.senders.video.track.id, 'cam-1');
  assert.equal(peer.senders.screen, undefined);
});

test('setPeerScreenTrack identifies screen track and emits screenTrack event', async () => {
  const manager = new PeerConnectionManager({ peerConnectionFactory: (c) => new MockRTCPeerConnection(c) });
  const peer = manager.createPeer('peer-remote');

  // Provide mock MediaStream on peerEntry if window is undefined in Node
  const cameraTrack = { kind: 'video', id: 'remote-cam-1' };
  const screenTrack = { kind: 'video', id: 'remote-screen-1' };
  peer.remoteStream = {
    tracks: [cameraTrack, screenTrack],
    getVideoTracks: () => [cameraTrack, screenTrack],
    removeTrack: function(t) { this.tracks = this.tracks.filter(x => x !== t); }
  };
  peer.remoteScreenStream = {
    tracks: [],
    getTracks: function() { return this.tracks; },
    addTrack: function(t) { this.tracks.push(t); },
    removeTrack: function(t) { this.tracks = this.tracks.filter(x => x !== t); }
  };

  let receivedScreenEvent = null;
  manager.on('screenTrack', (ev) => {
    receivedScreenEvent = ev;
  });

  manager.setPeerScreenTrack('peer-remote', 'remote-screen-1');
  assert.ok(receivedScreenEvent);
  assert.equal(receivedScreenEvent.peerId, 'peer-remote');
  assert.equal(receivedScreenEvent.track.id, 'remote-screen-1');
  assert.equal(peer.remoteScreenStream.tracks.length, 1);
  assert.equal(peer.remoteStream.tracks.length, 1); // camera remained
});

