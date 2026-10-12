/*
 * OpenMeet Client Core - SignalingClient
 * Zero-backend transport-agnostic signaling protocol
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import mqtt from 'mqtt';

export const DEFAULT_BROKER_URL = process.env.NEXT_PUBLIC_MQTT_URL || 'wss://broker.emqx.io:8084/mqtt';
export const DEFAULT_SIGNALING_TIMEOUT_MS = 5000;

export class SignalingClient {
  constructor({
    roomId,
    userId,
    userName,
    brokerUrl = DEFAULT_BROKER_URL,
    signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_WS_URL || null,
    signalingTimeoutMs = DEFAULT_SIGNALING_TIMEOUT_MS,
    transport = null
  }) {
    this.roomId = (roomId || 'default').trim().toUpperCase();
    this.userId = userId;
    this.userName = userName;
    this.brokerUrl = brokerUrl;
    this.signalingUrl = signalingUrl;
    this.signalingTimeoutMs = signalingTimeoutMs;
    this.transport = transport;

    this.broadcastTopic = `p2pmeet/r/${this.roomId}/all`;
    this.peerTopic = `p2pmeet/r/${this.roomId}/p/${this.userId}`;

    this.listeners = new Map();
    this.isConnected = false;
    this.isDestroyed = false;
    this.activeTransport = null;
    this.mqttStarted = false;
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

    const localDevelopment = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (typeof window.WebSocket === 'function' && (!localDevelopment || this.signalingUrl)) {
      this.connectDurableSignaling();
      return;
    }
    this.connectMqtt();
  }

  resolveSignalingUrl() {
    if (this.signalingUrl) {
      const url = new URL(this.signalingUrl, window.location.href);
      url.searchParams.set('room', this.roomId);
      return url.toString();
    }
    const url = new URL('/api/signaling', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('room', this.roomId);
    return url.toString();
  }

  connectDurableSignaling() {
    if (this.isDestroyed || this.mqttStarted) return;
    let socket;
    try {
      socket = new window.WebSocket(this.resolveSignalingUrl());
    } catch (error) {
      this.startMqttFallback(error);
      return;
    }
    this.socket = socket;
    let opened = false;
    const timeout = setTimeout(() => {
      if (!opened) this.startMqttFallback(new Error('Durable Object signaling connection timed out'));
    }, this.signalingTimeoutMs);

    socket.addEventListener('open', () => {
      if (this.isDestroyed || socket !== this.socket) return;
      opened = true;
      clearTimeout(timeout);
      this.activeTransport = 'durable-object';
      this.isConnected = true;
      this.emit('transportChanged', { transport: this.activeTransport });
      this.emit('connected');
      socket.send(JSON.stringify({
        type: 'join',
        userId: this.userId,
        userName: this.userName
      }));
    });

    socket.addEventListener('message', (event) => {
      if (this.isDestroyed || socket !== this.socket) return;
      try {
        const envelope = JSON.parse(event.data);
        if (envelope.type === 'broadcast') this.handleMessage(this.broadcastTopic, envelope.payload);
        else if (envelope.type === 'direct') this.handleMessage(this.peerTopic, envelope.payload);
        else if (envelope.type === 'error') this.emit('error', new Error(envelope.message || 'Signaling error'));
      } catch (error) {
        console.warn('[Signaling] Malformed Durable Object payload:', error);
      }
    });

    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      if (!this.isDestroyed && socket === this.socket) {
        this.startMqttFallback(new Error('Durable Object signaling transport failed'));
      }
    });

    socket.addEventListener('close', () => {
      clearTimeout(timeout);
      if (this.isDestroyed || socket !== this.socket) return;
      this.isConnected = false;
      if (!this.mqttStarted) {
        this.startMqttFallback(new Error('Durable Object signaling connection closed'));
      } else {
        this.emit('disconnected');
      }
    });
  }

  startMqttFallback(reason) {
    if (this.isDestroyed || this.mqttStarted) return;
    this.mqttStarted = true;
    this.isConnected = false;
    this.activeTransport = 'mqtt';
    if (this.socket && this.socket.readyState < 2) {
      const socket = this.socket;
      this.socket = null;
      try { socket.close(); } catch (_) {}
    }
    console.warn('[Signaling] Durable Object unavailable; falling back to MQTT.', reason);
    this.emit('transportChanged', { transport: this.activeTransport, fallback: true });
    this.connectMqtt();
  }

  connectMqtt() {
    if (this.isDestroyed) return;
    if (this.activeTransport !== 'mqtt') {
      this.activeTransport = 'mqtt';
      this.emit('transportChanged', { transport: this.activeTransport });
    }

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
    if (this.activeTransport === 'durable-object' && this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify({ type: 'direct', targetId, payload }));
      return;
    }
    const topic = `p2pmeet/r/${this.roomId}/p/${targetId}`;
    this.publish(topic, payload);
  }

  broadcast(payload) {
    const message = {
      roomId: this.roomId,
      senderId: this.userId,
      senderName: this.userName,
      ...payload
    };
    if (this.activeTransport === 'durable-object' && this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify({ type: 'broadcast', payload: message }));
      return;
    }
    this.publish(this.broadcastTopic, message);
  }

  publish(topic, payload) {
    if (this.client && this.client.connected) {
      this.client.publish(topic, JSON.stringify(payload), { qos: 0, retain: false });
    }
  }

  disconnect() {
    this.isDestroyed = true;
    if (this.socket) {
      try {
        this.socket.close();
      } catch (_) {}
      this.socket = null;
    }
    if (this.client) {
      try {
        this.client.publish(this.broadcastTopic, JSON.stringify({
          type: 'user-left',
          roomId: this.roomId,
          userId: this.userId,
          senderId: this.userId,
          senderName: this.userName
        }), { qos: 0, retain: false });
        this.client.end(true);
      } catch (_) {}
      this.client = null;
    }
    this.listeners.clear();
  }
}
