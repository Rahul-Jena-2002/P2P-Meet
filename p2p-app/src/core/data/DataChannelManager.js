/*
 * OpenMeet Client Core - DataChannelManager
 * Multi-stream data channel router with file chunking and backpressure control.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class DataChannelManager {
  constructor({ chunkSize = 65536, maxBufferSize = 262144 } = {}) {
    this.chunkSize = chunkSize; // Default 64KB chunks
    this.maxBufferSize = maxBufferSize; // 256KB threshold for backpressure
    this.channels = new Map(); // peerId -> RTCDataChannel
    this.listeners = new Map();
    this.fileReassemblers = new Map(); // fileId -> { chunks: [], totalChunks, metadata }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(fn => {
      try { fn(data); } catch (_) {}
    });
  }

  attachChannel(peerId, channel) {
    if (!channel) return;
    this.channels.set(peerId, channel);

    channel.onmessage = (event) => {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        this.handleIncoming(peerId, payload);
      } catch {
        this.handleIncoming(peerId, event.data);
      }
    };
  }

  detachChannel(peerId) {
    this.channels.delete(peerId);
  }

  handleIncoming(peerId, msg) {
    if (!msg || typeof msg !== 'object') {
      this.emit('message', { peerId, data: msg });
      return;
    }

    const { type } = msg;

    if (type === 'file-chunk') {
      this.handleFileChunk(msg);
      return;
    }

    // Specific event routing: 'chat', 'whiteboard', 'control', etc.
    if (type) {
      this.emit(type, msg);
    }
    this.emit('message', { peerId, data: msg });
  }

  handleFileChunk(chunk) {
    const { fileId, name, size, chunkIndex, totalChunks, data } = chunk;

    if (!this.fileReassemblers.has(fileId)) {
      this.fileReassemblers.set(fileId, {
        fileId,
        name,
        size,
        totalChunks,
        receivedChunks: new Map(),
      });
    }

    const tracker = this.fileReassemblers.get(fileId);
    tracker.receivedChunks.set(chunkIndex, data);

    this.emit('fileProgress', {
      fileId,
      progress: Math.round((tracker.receivedChunks.size / totalChunks) * 100)
    });

    if (tracker.receivedChunks.size === totalChunks) {
      // Reassemble in index order
      let fullContent = '';
      for (let i = 0; i < totalChunks; i++) {
        fullContent += tracker.receivedChunks.get(i);
      }

      const completed = {
        fileId,
        name: tracker.name,
        size: tracker.size,
        data: fullContent
      };

      this.fileReassemblers.delete(fileId);
      this.emit('fileComplete', completed);
    }
  }

  async sendFile(peerId, { fileId, name, size, data }) {
    const channel = this.channels.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      throw new Error(`DataChannel for peer ${peerId} is not open`);
    }

    const totalChunks = Math.ceil(data.length / this.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const slice = data.slice(i * this.chunkSize, (i + 1) * this.chunkSize);
      const chunkMsg = JSON.stringify({
        type: 'file-chunk',
        fileId,
        name,
        size,
        chunkIndex: i,
        totalChunks,
        data: slice
      });

      // Backpressure check
      if (channel.bufferedAmount > this.maxBufferSize) {
        await new Promise((resolve) => {
          const checkBuffer = () => {
            if (channel.bufferedAmount <= this.maxBufferSize / 2) {
              resolve();
            } else {
              setTimeout(checkBuffer, 20);
            }
          };
          checkBuffer();
        });
      }

      channel.send(chunkMsg);
    }
  }

  send(peerId, payload) {
    const channel = this.channels.get(peerId);
    if (channel && channel.readyState === 'open') {
      const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
      channel.send(msg);
    }
  }

  broadcast(payload) {
    const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.channels.forEach((channel) => {
      if (channel.readyState === 'open') {
        try { channel.send(msg); } catch (_) {}
      }
    });
  }

  destroy() {
    this.channels.clear();
    this.fileReassemblers.clear();
    this.listeners.clear();
  }
}
