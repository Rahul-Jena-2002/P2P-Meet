/*
 * OpenMeet Client Core - MediaManager
 * Vanilla client-side media acquisition, device enumeration, and stream track routing.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export class MediaManager {
  constructor(options = {}) {
    this.navigator = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    this.deviceEnumerator = options.deviceEnumerator || null;
    this.stream = null;
    this.screenStream = null;
    this.localScreenAudioTrack = null;
    this.isAudioEnabled = false;
    this.isVideoEnabled = false;
    this.isVoiceFocusEnabled = true; // noise suppression / voice focus on by default
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;
    this.listeners = new Map();
  }

  /**
   * 3-layer simulcast configuration:
   * q = quarter (180p, 150kbps), h = half (360p, 500kbps), f = full (720p/1080p, 1.5Mbps)
   */
  getSimulcastEncodings() {
    return [
      { rid: 'q', scaleResolutionDownBy: 4.0, maxBitrate: 150000 },
      { rid: 'h', scaleResolutionDownBy: 2.0, maxBitrate: 500000 },
      { rid: 'f', scaleResolutionDownBy: 1.0, maxBitrate: 1500000 }
    ];
  }

  /**
   * Mic audio constraints: mono 48kHz with inband FEC and DSP processing.
   */
  getMicAudioConstraints() {
    return {
      channelCount: 1,
      sampleRate: 48000,
      echoCancellation: this.isVoiceFocusEnabled,
      noiseSuppression: this.isVoiceFocusEnabled,
      autoGainControl: this.isVoiceFocusEnabled
    };
  }

  /**
   * Screen audio constraints: stereo 48kHz VBR with DSP processing completely bypassed.
   */
  getScreenAudioConstraints() {
    return {
      channelCount: 2,
      sampleRate: 48000,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      latency: 0
    };
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

  /**
   * Toggle Voice Focus (noise suppression) mode.
   * Applies applyConstraints() to live audio tracks so no stream re-acquire is needed.
   */
  async setVoiceFocusEnabled(enabled) {
    this.isVoiceFocusEnabled = Boolean(enabled);
    if (this.stream) {
      const tracks = this.stream.getAudioTracks();
      for (const t of tracks) {
        try {
          await t.applyConstraints({
            noiseSuppression: this.isVoiceFocusEnabled,
            echoCancellation: this.isVoiceFocusEnabled,
            autoGainControl: this.isVoiceFocusEnabled
          });
        } catch (e) {
          console.warn('[MediaManager] applyConstraints (voiceFocus) failed:', e);
        }
      }
    }
    this.emit('voiceFocusToggled', this.isVoiceFocusEnabled);
    return this.isVoiceFocusEnabled;
  }

  async acquireUserMedia({ camId, micId, audio = true, video = true } = {}) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not supported on this environment/origin');
    }
    if (!audio && !video) return null;

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }

    let stream;
    try {
      const audioProcessing = {
        echoCancellation: this.isVoiceFocusEnabled,
        noiseSuppression: this.isVoiceFocusEnabled,
        autoGainControl: this.isVoiceFocusEnabled,
        latency: 0
      };
      const constraints = {
        video: video ? (camId ? { deviceId: { exact: camId } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }) : false,
        audio: audio ? (micId
          ? { deviceId: { exact: micId }, ...audioProcessing }
          : audioProcessing) : false,
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      const fallback = {
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
        audio: audio ? { echoCancellation: this.isVoiceFocusEnabled, noiseSuppression: this.isVoiceFocusEnabled, autoGainControl: this.isVoiceFocusEnabled } : false
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia(fallback);
      } catch {
        if (audio && video) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: fallback.video, audio: false });
          } catch {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: fallback.audio });
            } catch {
              throw error;
            }
          }
        } else {
          throw error;
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
    const nav = this.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    if (!nav || !nav.mediaDevices?.getDisplayMedia) {
      throw new Error('getDisplayMedia is not supported');
    }

    const surface = options.surface || 'monitor';
    const audioRequested = options.audio !== false;
    const audioConstraints = audioRequested ? {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      latency: 0
    } : false;

    const constraints = {
      video: {
        cursor: 'never',
        displaySurface: surface,
        frameRate: { ideal: 60, max: 60 },
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 }
      },
      audio: audioConstraints,
      systemAudio: 'include',
      selfBrowserSurface: 'exclude'
    };

    let stream;
    try {
      stream = await nav.mediaDevices.getDisplayMedia(constraints);
    } catch (err) {
      console.warn('[MediaManager] Primary display constraints failed, trying standard fallback:', err);
      try {
        stream = await nav.mediaDevices.getDisplayMedia({
          video: { cursor: 'never', width: { ideal: 1920, max: 3840 }, height: { ideal: 1080, max: 2160 } },
          audio: audioConstraints,
          systemAudio: 'include'
        });
      } catch (err2) {
        stream = await nav.mediaDevices.getDisplayMedia({
          video: true,
          audio: audioConstraints
        });
      }
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && 'contentHint' in videoTrack) {
      videoTrack.contentHint = 'detail';
    }

    this.localScreenAudioTrack = stream.getAudioTracks()[0] || null;
    this.screenStream = stream;
    this.emit('screenStreamChanged', stream);
    if (this.localScreenAudioTrack) {
      this.emit('screenAudioTrackChanged', this.localScreenAudioTrack);
    }
    return stream;
  }

  async startScreenShare(options = {}) {
    return this.acquireDisplayMedia(options);
  }

  getLocalScreenAudioTrack() {
    return this.localScreenAudioTrack;
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
