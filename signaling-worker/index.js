import { DurableObject } from 'cloudflare:workers';

const MAX_SIGNAL_BYTES = 128 * 1024;
const MAX_ROOM_PARTICIPANTS = 100;

function send(socket, envelope) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(envelope));
  }
}

function participantFrom(socket) {
  return socket.deserializeAttachment?.() || null;
}

export class MeetingRoom extends DurableObject {
  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ joined: false });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    if (typeof message !== 'string' || new TextEncoder().encode(message).byteLength > MAX_SIGNAL_BYTES) {
      send(socket, { type: 'error', message: 'Signaling message is too large' });
      socket.close(1009, 'Message too large');
      return;
    }

    let data;
    try {
      data = JSON.parse(message);
    } catch {
      send(socket, { type: 'error', message: 'Invalid signaling message' });
      return;
    }

    if (data.type === 'join') {
      this.join(socket, data);
      return;
    }

    const sender = participantFrom(socket);
    if (!sender?.joined) {
      send(socket, { type: 'error', message: 'Join the room before sending messages' });
      return;
    }

    if (data.type === 'broadcast' && data.payload && typeof data.payload === 'object') {
      const payload = {
        ...data.payload,
        senderId: sender.userId,
        senderName: sender.userName
      };
      for (const peerSocket of this.ctx.getWebSockets()) {
        if (peerSocket === socket || participantFrom(peerSocket)?.joined !== true) continue;
        send(peerSocket, { type: 'broadcast', payload });
      }
    } else if (data.type === 'direct' && typeof data.targetId === 'string' && data.payload && typeof data.payload === 'object') {
      const payload = {
        ...data.payload,
        senderId: sender.userId,
        senderName: sender.userName
      };
      for (const peerSocket of this.ctx.getWebSockets()) {
        if (participantFrom(peerSocket)?.userId === data.targetId) {
          send(peerSocket, { type: 'direct', payload });
        }
      }
    } else {
      send(socket, { type: 'error', message: 'Unsupported signaling message' });
    }
  }

  join(socket, data) {
    const userId = typeof data.userId === 'string' ? data.userId.trim() : '';
    const userName = typeof data.userName === 'string' ? data.userName.trim().slice(0, 80) : '';
    if (!userId || userId.length > 128) {
      send(socket, { type: 'error', message: 'Invalid participant identity' });
      socket.close(1008, 'Invalid participant identity');
      return;
    }

    const sockets = this.ctx.getWebSockets();
    const peers = new Map();
    for (const peerSocket of sockets) {
      const participant = participantFrom(peerSocket);
      if (participant?.joined && participant.userId !== userId) {
        peers.set(participant.userId, participant);
      }
    }
    if (peers.size >= MAX_ROOM_PARTICIPANTS) {
      send(socket, { type: 'error', message: 'Meeting is full' });
      socket.close(1008, 'Meeting is full');
      return;
    }

    socket.serializeAttachment({ joined: true, userId, userName });

    // Notify the late joiner about existing participants, then announce them
    // to the room so the browser can establish its WebRTC peer connections.
    for (const participant of peers.values()) {
      send(socket, {
        type: 'broadcast',
        payload: {
          type: 'user-joined',
          userId: participant.userId,
          userName: participant.userName,
          senderId: participant.userId
        }
      });
    }

    const firstConnectionForUser = !sockets.some((peerSocket) => {
      if (peerSocket === socket) return false;
      const participant = participantFrom(peerSocket);
      return participant?.joined && participant.userId === userId;
    });
    if (firstConnectionForUser) {
      const payload = { type: 'user-joined', userId, userName, senderId: userId };
      for (const peerSocket of sockets) {
        if (peerSocket !== socket && participantFrom(peerSocket)?.joined) {
          send(peerSocket, { type: 'broadcast', payload });
        }
      }
    }
  }

  webSocketClose(socket) {
    this.removeParticipant(socket);
  }

  webSocketError(socket) {
    this.removeParticipant(socket);
  }

  removeParticipant(socket) {
    const participant = participantFrom(socket);
    if (!participant?.joined || participant.leftNotified) return;
    socket.serializeAttachment({ ...participant, leftNotified: true });
    const anotherSession = this.ctx.getWebSockets().some((peerSocket) => {
      if (peerSocket === socket) return false;
      const peer = participantFrom(peerSocket);
      return peer?.joined && peer.userId === participant.userId;
    });
    if (anotherSession) return;

    const payload = {
      type: 'user-left',
      userId: participant.userId,
      senderId: participant.userId,
      senderName: participant.userName
    };
    for (const peerSocket of this.ctx.getWebSockets()) {
      if (peerSocket !== socket && participantFrom(peerSocket)?.joined) {
        send(peerSocket, { type: 'broadcast', payload });
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = url.searchParams.get('room')?.trim().toUpperCase();
    if (!room || room.length > 100 || !/^[A-Z0-9_-]+$/.test(room)) {
      return new Response('Invalid meeting room', { status: 400 });
    }
    const id = env.MEETING_ROOMS.idFromName(room);
    return env.MEETING_ROOMS.get(id).fetch(request);
  }
};
