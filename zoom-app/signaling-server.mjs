/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Local Wi-Fi & LAN WebRTC Signaling Server
 */
import { WebSocketServer } from 'ws';

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

// roomId -> Map<userId, { ws, userName }>
const rooms = new Map();
// ws -> { roomId, userId, userName }
const socketMeta = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { type } = data;

      switch (type) {
        case 'join-room': {
          const { roomId, userId, userName, state } = data;
          socketMeta.set(ws, { roomId, userId, userName });

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          const room = rooms.get(roomId);

          // Get existing users in room to return to caller
          const existingUsers = [];
          room.forEach((meta, uId) => {
            existingUsers.push({ userId: uId, userName: meta.userName, state: meta.state || {} });
          });

          // Send list of existing users to the joining user
          ws.send(JSON.stringify({
            type: 'all-users',
            users: existingUsers
          }));

          // Notify existing users about the new joiner
          room.forEach((meta) => {
            if (meta.ws.readyState === ws.OPEN) {
              meta.ws.send(JSON.stringify({
                type: 'user-joined',
                userId,
                userName,
                state: state || {}
              }));
            }
          });

          room.set(userId, { ws, userName, state: state || {} });
          console.log(`[Signaling] User "${userName}" (${userId}) joined room "${roomId}". Room count: ${room.size}`);
          break;
        }

        case 'PEER_MEDIA_STATE': {
          const meta = socketMeta.get(ws);
          if (meta) {
            const room = rooms.get(meta.roomId);
            if (room && room.has(meta.userId)) {
              const uMeta = room.get(meta.userId);
              uMeta.state = { ...(uMeta.state || {}), ...data };
            }
            if (room) {
              const payload = JSON.stringify(data);
              room.forEach((peer) => {
                if (peer.ws !== ws && peer.ws.readyState === ws.OPEN) {
                  peer.ws.send(payload);
                }
              });
            }
          }
          break;
        }

        case 'signal': {
          // Relay WebRTC signal (offer/answer/ice) to target peer
          const { targetId, senderId, senderName, signalData } = data;
          const meta = socketMeta.get(ws);
          if (!meta) return;

          const room = rooms.get(meta.roomId);
          if (room && room.has(targetId)) {
            const targetMeta = room.get(targetId);
            if (targetMeta.ws.readyState === ws.OPEN) {
              targetMeta.ws.send(JSON.stringify({
                type: 'signal',
                senderId,
                senderName,
                signalData
              }));
            }
          }
          break;
        }

        case 'chat': {
          const meta = socketMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (room) {
            const payload = JSON.stringify({
              type: 'chat',
              ...data.payload
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
          const meta = socketMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (room) {
            const payload = JSON.stringify({
              type: 'reaction',
              ...data.payload
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
          const meta = socketMeta.get(ws);
          if (meta) {
            const room = rooms.get(meta.roomId);
            if (room) {
              const payload = JSON.stringify(data);
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
      console.error('[Signaling Error]', e);
    }
  });

  ws.on('close', () => {
    const meta = socketMeta.get(ws);
    if (meta) {
      const { roomId, userId, userName } = meta;
      socketMeta.delete(ws);
      const room = rooms.get(roomId);
      if (room) {
        room.delete(userId);
        console.log(`[Signaling] User "${userName}" (${userId}) left room "${roomId}". Remaining: ${room.size}`);
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

console.log(`🚀 OpenMeet Local Signaling Server listening on ws://0.0.0.0:${PORT}`);
