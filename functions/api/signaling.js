export async function onRequest({ request, env }) {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('WebSocket upgrade required', { status: 426 });
  }

  const room = new URL(request.url).searchParams.get('room')?.trim().toUpperCase();
  if (!room || room.length > 100 || !/^[A-Z0-9_-]+$/.test(room)) {
    return new Response('Invalid meeting room', { status: 400 });
  }

  try {
    const roomId = env.MEETING_ROOMS.idFromName(room);
    return await env.MEETING_ROOMS.get(roomId).fetch(request);
  } catch (error) {
    console.error('[Pages Signaling] Durable Object binding unavailable:', error);
    return new Response('Signaling service unavailable', { status: 503 });
  }
}
