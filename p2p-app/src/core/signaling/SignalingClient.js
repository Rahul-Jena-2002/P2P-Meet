/*
 * OpenMeet Client Core - SignalingClient
 * Zero-backend transport-agnostic signaling protocol
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import mqtt from 'mqtt';

export const DEFAULT_BROKER_URL = process.env.NEXT_PUBLIC_MQTT_URL || 'wss://broker.emqx.io:8084/mqtt';

export class SignalingClient {
  constructor({ roomId, userId, userName, brokerUrl = DEFAULT_BROKER_URL, transport = null }) {
    this.roomId = (roomId || 'default').trim().toUpperCase();
    this.userId = userId;
    this.userName = userName;
    this.brokerUrl = brokerUrl;
    this.transport = transport;

    this.broadcastTopic = `p2pmeet/r/${this.roomId}/all`;
    this.peerTopic = `p2pmeet/r/${this.roomId}/p/${this.userId}`;

    this.listeners = new Map();
    this.isConnected = false;
    this.isDestroyed = false;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(fn => {
        try { fn(data); } catch (err) { console.warn(`[Signaling] Listener error on ${event}:`, err); }
      });
    }
  }

  connect() {
    if (this.transport) {
      this.transport.connect?.();
      return;
    }

    if (typeof window === 'undefined') return;

    const clientId = `p2p_${this.userId}_${Math.random().toString(16).slice(2, 8)}`;
    try {
      this.client = mqtt.connect(this.brokerUrl, {
        clientId,
        keepalive: 30,
        clean: true,
        reconnectPeriod: 2500,
        connectTimeout: 10000
      });

      this.client.on('connect', () => {
        if (this.isDestroyed) return;
        this.isConnected = true;
        this.emit('connected');

        this.client.subscribe([this.broadcastTopic, this.peerTopic], { qos: 0 }, (err) => {
          if (err) {
            console.warn('[Signaling] Subscription warning:', err);
            return;
          }

          // Announce presence to room
          this.broadcast({
            type: 'user-joined',
            userId: this.userId,
            userName: this.userName
          });
        });
      });

      this.client.on('message', (topic, message) => {
        if (this.isDestroyed) return;
        try {
          const payload = JSON.parse(message.toString());
          this.handleMessage(topic, payload);
        } catch (e) {
          console.warn('[Signaling] Malformed payload:', e);
        }
      });

      this.client.on('error', (err) => this.emit('error', err));
      this.client.on('close', () => {
        this.isConnected = false;
        this.emit('disconnected');
      });
    } catch (err) {
      this.emit('error', err);
    }
  }

  handleMessage(topic, msg) {
    const originId = msg.senderId || msg.userId;
    // Ignore self-published messages
    if (originId === this.userId) return;

    const { type, senderId, senderName, userId, userName } = msg;

    if (topic === this.broadcastTopic) {
      switch (type) {
        case 'user-joined':
          this.emit('peer-joined', { userId, userName });
          break;
        case 'user-left':
          this.emit('peer-left', { userId: originId });
          break;
        default:
          this.emit('data', msg);
          break;
      }
    } else if (topic === this.peerTopic) {
      switch (type) {
        case 'announce-presence':
          this.emit('peer-presence', { userId, userName });
          break;
        case 'signal':
          this.emit('peer-signal', {
            senderId,
            senderName,
            signalData: msg.signalData
          });
          break;
        default:
          this.emit('peer-direct', msg);
          break;
      }
    }
  }

  sendSignal(targetId, signalData) {
    this.sendDirect(targetId, {
      type: 'signal',
      senderId: this.userId,
      senderName: this.userName,
      signalData
    });
  }

  sendDirect(targetId, payload) {
    const topic = `p2pmeet/r/${this.roomId}/p/${targetId}`;
    this.publish(topic, payload);
  }

  broadcast(payload) {
    this.publish(this.broadcastTopic, {
      roomId: this.roomId,
      senderId: this.userId,
      senderName: this.userName,
      ...payload
    });
  }

  publish(topic, payload) {
    if (this.client && this.client.connected) {
      this.client.publish(topic, JSON.stringify(payload), { qos: 0, retain: false });
    }
  }

  disconnect() {
    this.isDestroyed = true;
    if (this.client) {
      try {
        this.broadcast({ type: 'user-left', userId: this.userId });
        this.client.end(true);
      } catch (_) {}
      this.client = null;
    }
    this.listeners.clear();
  }
}
