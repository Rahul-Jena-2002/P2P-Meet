/*
 * p2pmeet - Local Wi-Fi & LAN WebRTC Signaling Server
 * Hardened with message rate limiting, identity spoofing protection, and input sanitization.
 */
import { WebSocketServer } from 'ws';

const PORT = 3001;
const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB max signaling message
const MAX_MSGS_PER_SECOND = 60;

const wss = new WebSocketServer({
  port: PORT,
  host: '0.0.0.0',
  maxPayload: MAX_PAYLOAD_BYTES
});

// roomId -> Map<userId, { ws, userName, state }>
const rooms = new Map();
// ws -> { roomId, userId, userName, lastReset: number, msgCount: number }
const socketMeta = new Map();

wss.on('connection', (ws) => {
  socketMeta.set(ws, {
    roomId: null,
    userId: null,
    userName: null,
    lastReset: Date.now(),
    msgCount: 0
  });

  ws.on('message', (message) => {
    try {
      const meta = socketMeta.get(ws);
      if (!meta) return;

      // 1. Message rate limiting (Item 6)
      const now = Date.now();
      if (now - meta.lastReset > 1000) {
        meta.lastReset = now;
        meta.msgCount = 0;
      }
      meta.msgCount++;
      if (meta.msgCount > MAX_MSGS_PER_SECOND) {
        ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded. Throttling.' }));
        return;
      }

      if (message.length > MAX_PAYLOAD_BYTES) {
        ws.send(JSON.stringify({ type: 'error', message: 'Payload exceeds 64KB maximum limit.' }));
        return;
      }

      const data = JSON.parse(message.toString());
      const { type } = data;

      switch (type) {
        case 'join-room': {
          let { roomId, userId, userName, state } = data;
          if (!roomId || typeof roomId !== 'string' || roomId.length > 64) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid room ID' }));
            return;
          }
          if (!userId || typeof userId !== 'string' || userId.length > 64) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid user ID' }));
            return;
          }
          userName = (typeof userName === 'string' && userName.trim()) ? userName.trim().slice(0, 64) : 'Peer';

          meta.roomId = roomId;
          meta.userId = userId;
          meta.userName = userName;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          const room = rooms.get(roomId);

          // Get existing users in room to return to caller
          const existingUsers = [];
          room.forEach((m, uId) => {
            existingUsers.push({ userId: uId, userName: m.userName, state: m.state || {} });
          });

          // Send list of existing users to the joining user
          ws.send(JSON.stringify({
            type: 'all-users',
            users: existingUsers
          }));

          // Notify existing users about the new joiner
          room.forEach((m) => {
            if (m.ws.readyState === ws.OPEN) {
              m.ws.send(JSON.stringify({
                type: 'user-joined',
                userId,
                userName,
                state: state || {}
              }));
            }
          });

          room.set(userId, { ws, userName, state: state || {} });
          console.log(`[Signaling] Peer joined room "${roomId}". Total participants: ${room.size}`);
          break;
        }

        case 'PEER_MEDIA_STATE': {
          if (!meta.roomId || !meta.userId) return;
          const room = rooms.get(meta.roomId);
          if (room && room.has(meta.userId)) {
            const uMeta = room.get(meta.userId);
            uMeta.state = { ...(uMeta.state || {}), ...data };
          }
          if (room) {
            const payload = JSON.stringify({
              ...data,
              userId: meta.userId // strictly bound to verified session
            });
            room.forEach((peer) => {
              if (peer.ws !== ws && peer.ws.readyState === ws.OPEN) {
                peer.ws.send(payload);
              }
            });
          }
          break;
        }

        case 'signal': {
          // Relay WebRTC signal (offer/answer/ice) to target peer
          // Item 5 & 13: Enforce that senderId and senderName come from session meta (prevents spoofing)
          if (!meta.roomId || !meta.userId) return;
          const { targetId, signalData } = data;
          if (!targetId) return;

          const room = rooms.get(meta.roomId);
          if (room && room.has(targetId)) {
            const targetMeta = room.get(targetId);
            if (targetMeta.ws.readyState === ws.OPEN) {
              targetMeta.ws.send(JSON.stringify({
                type: 'signal',
                senderId: meta.userId,
                senderName: meta.userName,
                signalData
              }));
            }
          }
          break;
        }

        case 'chat': {
          if (!meta.roomId || !meta.userId) return;
          const room = rooms.get(meta.roomId);
          if (room) {
            const textContent = (data.payload?.content || '').toString().slice(0, 4000);
            const payload = JSON.stringify({
              type: 'chat',
              ...data.payload,
              content: textContent,
              senderId: meta.userId,
              senderName: meta.userName
            });
            room.forEach((peer) => {
              if (peer.ws.readyState === ws.OPEN) {
                peer.ws.send(payload);
              }
            });
          }
          break;
        }

        case 'reaction': {
          if (!meta.roomId || !meta.userId) return;
          const room = rooms.get(meta.roomId);
          if (room) {
            const payload = JSON.stringify({
              type: 'reaction',
              ...data.payload,
              senderId: meta.userId
            });
            room.forEach((peer) => {
              if (peer.ws.readyState === ws.OPEN) {
                peer.ws.send(payload);
              }
            });
          }
          break;
        }

        default: {
          if (meta.roomId) {
            const room = rooms.get(meta.roomId);
            if (room) {
              const payload = JSON.stringify({
                ...data,
                senderId: meta.userId
              });
              room.forEach((peer) => {
                if (peer.ws !== ws && peer.ws.readyState === ws.OPEN) {
                  peer.ws.send(payload);
                }
              });
            }
          }
          break;
        }
      }
    } catch (e) {
      console.warn('[Signaling Warning] Malformed packet dropped');
    }
  });

  ws.on('close', () => {
    const meta = socketMeta.get(ws);
    socketMeta.delete(ws);
    if (meta && meta.roomId && meta.userId) {
      const { roomId, userId } = meta;
      const room = rooms.get(roomId);
      if (room) {
        room.delete(userId);
        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          // Notify remaining users
          const leaveMsg = JSON.stringify({ type: 'user-left', userId });
          room.forEach((peer) => {
            if (peer.ws.readyState === ws.OPEN) {
              peer.ws.send(leaveMsg);
            }
          });
        }
      }
    }
  });
});

console.log(`🚀 p2pmeet Hardened Signaling Server listening on ws://0.0.0.0:${PORT}`);
