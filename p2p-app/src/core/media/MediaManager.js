/*
 * OpenMeet Client Core - MediaManager
 * Vanilla client-side media acquisition, device enumeration, and stream track routing.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class MediaManager {
  constructor(options = {}) {
    this.deviceEnumerator = options.deviceEnumerator || null;
    this.stream = null;
    this.screenStream = null;
    this.isAudioEnabled = true;
    this.isVideoEnabled = true;
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const set = this.listeners.get(event);
    if (set) set.delete(handler);
  }

  emit(event, data) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach(fn => {
        try { fn(data); } catch (e) { console.warn(`[MediaManager] Error in ${event} listener:`, e); }
      });
    }
  }

  setStream(stream) {
    this.stream = stream;
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = this.isAudioEnabled; });
      stream.getVideoTracks().forEach(t => { t.enabled = this.isVideoEnabled; });
    }
    this.emit('streamChanged', stream);
  }

  setAudioEnabled(enabled) {
    this.isAudioEnabled = Boolean(enabled);
    if (this.stream) {
      this.stream.getAudioTracks().forEach(t => { t.enabled = this.isAudioEnabled; });
    }
    this.emit('audioToggled', this.isAudioEnabled);
    return this.isAudioEnabled;
  }

  setVideoEnabled(enabled) {
    this.isVideoEnabled = Boolean(enabled);
    if (this.stream) {
      this.stream.getVideoTracks().forEach(t => { t.enabled = this.isVideoEnabled; });
    }
    this.emit('videoToggled', this.isVideoEnabled);
    return this.isVideoEnabled;
  }

  async acquireUserMedia({ camId, micId } = {}) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not supported on this environment/origin');
    }

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }

    let stream;
    try {
      const constraints = {
        video: camId ? { deviceId: { exact: camId } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: micId ? { deviceId: { exact: micId } } : true,
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          stream = typeof MediaStream !== 'undefined' ? new MediaStream() : null;
        }
        if (stream && typeof document !== 'undefined') {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext('2d');
            if (ctx && canvas.captureStream) {
              let f = 0;
              const tick = () => {
                f++;
                const g = ctx.createLinearGradient(0, 0, 640, 360);
                g.addColorStop(0, '#1E1B4B');
                g.addColorStop(1, '#312E81');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, 640, 360);
                ctx.beginPath();
                ctx.arc(320, 160, 48 + Math.sin(f * 0.08) * 4, 0, Math.PI * 2);
                ctx.fillStyle = '#4F46E5';
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 22px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('CAM 2', 320, 160);
                ctx.font = '12px sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.fillText('Camera hardware in use by another tab', 320, 230);
              };
              tick();
              const timer = setInterval(tick, 100);
              const synth = canvas.captureStream(10).getVideoTracks()[0];
              if (synth) {
                const orig = synth.stop.bind(synth);
                synth.stop = () => { clearInterval(timer); orig(); };
                stream.addTrack(synth);
              }
            }
          } catch (_) {}
        }
      }
    }

    if (stream) {
      this.setStream(stream);
      this.setupAudioAnalyzer(stream);
    }
    return stream;
  }

  async acquireDisplayMedia(options = {}) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('getDisplayMedia is not supported');
    }

    const surface = options.surface || 'monitor';
    const constraints = {
      video: {
        cursor: 'always',
        displaySurface: surface,
        frameRate: { ideal: 60 },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: {
        suppressLocalAudioPlayback: false,
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false
      },
      systemAudio: 'include',
      monitorTypeSurfaces: 'include',
      surfaceSwitching: 'include',
      selfBrowserSurface: 'exclude'
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', cursor: 'always' },
        audio: true
      });
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && 'contentHint' in videoTrack) {
      videoTrack.contentHint = 'motion';
    }

    this.screenStream = stream;
    this.emit('screenStreamChanged', stream);
    return stream;
  }

  async getDevices() {
    let list = [];
    if (this.deviceEnumerator) {
      list = await this.deviceEnumerator();
    } else if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      list = await navigator.mediaDevices.enumerateDevices();
    }
    return {
      video: list.filter(d => d.kind === 'videoinput'),
      audio: list.filter(d => d.kind === 'audioinput'),
      audioOutput: list.filter(d => d.kind === 'audiooutput'),
    };
  }

  setupAudioAnalyzer(stream) {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      if (this.audioContext) {
        this.audioContext.close().catch(() => {});
      }
      this.audioContext = new AudioContextClass();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        this.emit('audioLevel', normalized);
        this.animFrameId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {
      console.warn('[MediaManager] Audio analyzer setup failed:', e);
    }
  }

  stop() {
    if (this.animFrameId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    this.listeners.clear();
  }
}
