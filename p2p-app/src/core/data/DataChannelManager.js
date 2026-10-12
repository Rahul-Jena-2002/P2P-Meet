/*
 * OpenMeet Client Core - DataChannelManager
 * Multi-stream data channel router with direct, chunked file transfer.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const FILE_PACKET_MAGIC = new Uint8Array([0x50, 0x32, 0x50, 0x46]); // P2PF
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_HEADER_SIZE = 16 * 1024;

export class DataChannelManager {
  constructor({ chunkSize = 16 * 1024, maxBufferSize = 1024 * 1024 } = {}) {
    this.chunkSize = chunkSize;
    this.maxBufferSize = maxBufferSize;
    this.channels = new Map();
    this.listeners = new Map();
    this.fileReassemblers = new Map();
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
    channel.binaryType = 'arraybuffer';
    channel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer || ArrayBuffer.isView(event.data)) {
        this.handleFilePacket(peerId, event.data);
        return;
      }
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
    for (const [fileId, transfer] of this.fileReassemblers) {
      if (transfer.peerId === peerId) this.fileReassemblers.delete(fileId);
    }
  }

  handleIncoming(peerId, msg) {
    if (!msg || typeof msg !== 'object') {
      this.emit('message', { peerId, data: msg });
      return;
    }
    if (msg.type) this.emit(msg.type, msg);
    this.emit('message', { peerId, data: msg });
  }

  handleFilePacket(peerId, rawPacket) {
    try {
      const packet = rawPacket instanceof ArrayBuffer
        ? new Uint8Array(rawPacket)
        : new Uint8Array(rawPacket.buffer, rawPacket.byteOffset, rawPacket.byteLength);
      if (packet.byteLength < 8 || !FILE_PACKET_MAGIC.every((byte, i) => packet[i] === byte)) return;

      const headerLength = new DataView(packet.buffer, packet.byteOffset, packet.byteLength).getUint32(4);
      if (!headerLength || headerLength > MAX_HEADER_SIZE || 8 + headerLength > packet.byteLength) return;
      const header = JSON.parse(new TextDecoder().decode(packet.subarray(8, 8 + headerLength)));
      const { fileId, name, size, mimeType, chunkIndex, totalChunks } = header;
      const chunk = packet.subarray(8 + headerLength);
      if (typeof fileId !== 'string' || !fileId || typeof name !== 'string' ||
          !Number.isSafeInteger(size) || size < 0 || size > MAX_FILE_SIZE ||
          !Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) ||
          totalChunks < 1 || totalChunks > Math.ceil(MAX_FILE_SIZE / this.chunkSize) ||
          chunkIndex < 0 || chunkIndex >= totalChunks || chunk.byteLength > this.chunkSize) return;

      let transfer = this.fileReassemblers.get(fileId);
      if (!transfer) {
        transfer = {
          fileId, peerId, name, size, mimeType, totalChunks,
          chunks: new Array(totalChunks), receivedChunks: 0, receivedBytes: 0,
        };
        this.fileReassemblers.set(fileId, transfer);
      }
      if (transfer.peerId !== peerId || transfer.totalChunks !== totalChunks ||
          transfer.size !== size || transfer.name !== name) return;

      if (!transfer.chunks[chunkIndex]) {
        transfer.chunks[chunkIndex] = chunk.slice();
        transfer.receivedChunks++;
        transfer.receivedBytes += chunk.byteLength;
      }
      this.emit('fileProgress', {
        fileId, peerId,
        progress: size === 0 ? 100 : Math.min(100, Math.round((transfer.receivedBytes / size) * 100)),
      });

      if (transfer.receivedChunks === totalChunks) {
        if (transfer.receivedBytes !== size) {
          this.fileReassemblers.delete(fileId);
          this.emit('fileError', { fileId, peerId, error: 'Received file size did not match the sender’s file.' });
          return;
        }
        const blob = new Blob(transfer.chunks, { type: transfer.mimeType || 'application/octet-stream' });
        this.fileReassemblers.delete(fileId);
        this.emit('fileComplete', {
          fileId, peerId, name, size, mimeType: transfer.mimeType, blob,
        });
      }
    } catch (error) {
      this.emit('fileError', { peerId, error: error?.message || 'Could not read incoming file data.' });
    }
  }

  async waitForBuffer(channel) {
    if (channel.readyState !== 'open') throw new Error('The peer connection closed during file transfer.');
    if (channel.bufferedAmount <= this.maxBufferSize) return;

    channel.bufferedAmountLowThreshold = Math.floor(this.maxBufferSize / 2);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('File transfer stalled. Check the peer connection and try again.')), 30000);
      const cleanup = () => {
        clearTimeout(timeout);
        channel.removeEventListener?.('bufferedamountlow', onLow);
        channel.removeEventListener?.('close', onClose);
        if (channel.onbufferedamountlow === onLow) channel.onbufferedamountlow = null;
      };
      const finish = (error) => {
        cleanup();
        error ? reject(error) : resolve();
      };
      const onLow = () => finish();
      const onClose = () => finish(new Error('The peer connection closed during file transfer.'));
      if (channel.addEventListener) {
        channel.addEventListener('bufferedamountlow', onLow, { once: true });
        channel.addEventListener('close', onClose, { once: true });
      } else {
        channel.onbufferedamountlow = onLow;
      }
      if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) finish();
    });
  }

  async sendFile(peerId, file) {
    const channel = this.channels.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      throw new Error(`Peer ${peerId} is not connected for direct file sharing.`);
    }
    if (!file || typeof file.slice !== 'function' || !Number.isSafeInteger(file.size)) {
      throw new TypeError('Choose a file from your device to share.');
    }
    if (file.size > MAX_FILE_SIZE) throw new Error('Files must be 500 MB or smaller.');

    const fileId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const totalChunks = Math.max(1, Math.ceil(file.size / this.chunkSize));
    const encoder = new TextEncoder();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * this.chunkSize;
      const chunk = new Uint8Array(await file.slice(start, Math.min(start + this.chunkSize, file.size)).arrayBuffer());
      const header = encoder.encode(JSON.stringify({
        fileId,
        name: file.name || 'shared-file',
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        chunkIndex,
        totalChunks,
      }));
      if (header.byteLength > MAX_HEADER_SIZE) throw new Error('File name is too long to share.');

      const packet = new Uint8Array(8 + header.byteLength + chunk.byteLength);
      packet.set(FILE_PACKET_MAGIC, 0);
      new DataView(packet.buffer).setUint32(4, header.byteLength);
      packet.set(header, 8);
      packet.set(chunk, 8 + header.byteLength);

      await this.waitForBuffer(channel);
      if (channel.readyState !== 'open') throw new Error('The peer connection closed during file transfer.');
      channel.send(packet.buffer);
      this.emit('fileSendProgress', {
        fileId, peerId, name: file.name, size: file.size,
        progress: file.size === 0 ? 100 : Math.min(100, Math.round(((start + chunk.byteLength) / file.size) * 100)),
      });
    }
    return { fileId, peerId, name: file.name, size: file.size };
  }

  send(peerId, payload) {
    const channel = this.channels.get(peerId);
    if (channel && channel.readyState === 'open') {
      channel.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
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
