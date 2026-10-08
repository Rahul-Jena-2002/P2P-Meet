'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { videoProcessor } from '../lib/videoProcessor';
import { MediaManager } from '../core/media/MediaManager';

const MediaContext = createContext(null);

export function MediaProvider({ children }) {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [devices, setDevices] = useState({ video: [], audio: [], audioOutput: [] });
  const [selectedCam, setSelectedCam] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for mic meter
  const [videoFilter, setVideoFilterState] = useState('none');
  const [mediaError, setMediaError] = useState(null);
  const [voiceFocusEnabled, setVoiceFocusEnabledState] = useState(true);

  const mediaManagerRef = useRef(null);
  if (!mediaManagerRef.current) {
    mediaManagerRef.current = new MediaManager();
  }
  const mediaManager = mediaManagerRef.current;
  const rawStreamRef = useRef(null);

  // Initialize or re-acquire user media
  const initMedia = useCallback(async (camId, micId) => {
    try {
      setMediaError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setMediaError("Mobile browsers restrict camera/mic on HTTP. You can still join to view, chat, and watch!");
        setVideoEnabled(false);
        setAudioEnabled(false);
        return null;
      }

      const stream = await mediaManager.acquireUserMedia({ camId, micId });
      rawStreamRef.current = stream;

      // acquireUserMedia -> setStream already applies mediaManager's enabled flags

      const aiFilters = ['blur', 'blur-light', 'blur-heavy', 'studio', 'rocket', 'nature', 'moon', 'astronaut'];
      if (aiFilters.includes(videoFilter)) {
        videoProcessor.start(stream, videoFilter, (updated) => {
          setLocalStream(updated);
        }).then((processed) => {
          setLocalStream(processed || stream);
        });
      } else {
        setLocalStream(stream);
      }

      // Enumerate hardware devices
      try {
        const devs = await mediaManager.getDevices();
        setDevices(devs);
        if (!selectedCam && devs.video.length > 0) setSelectedCam(devs.video[0].deviceId);
        if (!selectedMic && devs.audio.length > 0) setSelectedMic(devs.audio[0].deviceId);
        if (devs.audioOutput.length > 0) {
          const savedSpeaker = typeof localStorage !== 'undefined' ? localStorage.getItem('p2pmeet_selected_speaker') : null;
          const match = devs.audioOutput.find(d => d.deviceId === savedSpeaker);
          setSelectedSpeaker(match ? match.deviceId : devs.audioOutput[0].deviceId);
        }
      } catch (err) {
        console.warn('Could not enumerate devices:', err);
      }

      return stream;
    } catch (err) {
      console.warn('Camera/Mic permission notice:', err);
      setMediaError("Camera/Mic not available on this connection. Joining in Viewer mode.");
      setVideoEnabled(false);
      setAudioEnabled(false);
      return null;
    }
  }, [audioEnabled, videoEnabled, selectedCam, selectedMic, videoFilter, mediaManager]);

  useEffect(() => {
    const unsubAudio = mediaManager.on('audioLevel', (lvl) => setAudioLevel(lvl));
    initMedia();
    return () => {
      unsubAudio();
      mediaManager.stop();
    };
  }, []);

  const toggleAudio = useCallback(() => {
    const next = !audioEnabled;
    mediaManager.setAudioEnabled(next);
    setAudioEnabled(next);
    return next;
  }, [audioEnabled, mediaManager]);

  const toggleVoiceFocus = useCallback(async () => {
    const next = !voiceFocusEnabled;
    await mediaManager.setVoiceFocusEnabled(next);
    setVoiceFocusEnabledState(next);
    return next;
  }, [voiceFocusEnabled, mediaManager]);

  const toggleVideo = useCallback(async () => {
    const next = !videoEnabled;
    mediaManager.setVideoEnabled(next);
    setVideoEnabled(next);
    const hasLiveVideo = mediaManager.stream?.getVideoTracks().some(t => t.readyState === 'live');
    if (next && !hasLiveVideo) {
      // No usable camera track (viewer mode / ended track): acquire it now
      const stream = await initMedia(selectedCam, selectedMic);
      if (!stream?.getVideoTracks().length) {
        mediaManager.setVideoEnabled(false);
        setVideoEnabled(false);
        return false;
      }
    }
    return next;
  }, [videoEnabled, mediaManager, initMedia, selectedCam, selectedMic]);

  const switchCamera = useCallback(async (deviceId) => {
    setSelectedCam(deviceId);
    await initMedia(deviceId, selectedMic);
  }, [initMedia, selectedMic]);

  const switchMicrophone = useCallback(async (deviceId) => {
    setSelectedMic(deviceId);
    await initMedia(selectedCam, deviceId);
  }, [initMedia, selectedCam]);

  // Switch sound output / speaker destination (setSinkId)
  const switchAudioOutput = useCallback(async (deviceId) => {
    setSelectedSpeaker(deviceId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('p2pmeet_selected_speaker', deviceId);
    }
    // Route all existing non-muted media elements to selected output
    if (typeof document !== 'undefined') {
      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach(el => {
        if (!el.muted && typeof el.setSinkId === 'function') {
          el.setSinkId(deviceId).catch(err => {
            console.warn('setSinkId error:', err);
          });
        }
      });
    }
  }, []);

  // Play a pleasant test chime to verify selected sound output device
  const testAudioOutput = useCallback(async (deviceId = selectedSpeaker) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (typeof ctx.setSinkId === 'function' && deviceId) {
        await ctx.setSinkId(deviceId).catch(() => {});
      }
      const now = ctx.currentTime;
      // High-clarity 3-note chime (F5 -> A5 -> C6)
      [698.46, 880.00, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.3);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1500);
    } catch (e) {
      console.warn('Test audio output error:', e);
    }
  }, [selectedSpeaker]);

  const [isWatchPartyMode, setIsWatchPartyMode] = useState(false);

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    setScreenStream(null);
    setScreenSharing(false);
    setIsWatchPartyMode(false);
  }, [screenStream]);

  const startScreenShare = useCallback(async (options = {}) => {
    try {
      const stream = await mediaManager.acquireDisplayMedia(options);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stream.getTracks().forEach(t => t.stop());
          setScreenStream(null);
          setScreenSharing(false);
          setIsWatchPartyMode(false);
        };
      }

      setScreenStream(stream);
      setScreenSharing(true);
      return stream;
    } catch (err) {
      console.warn('Screen share canceled or denied:', err);
      return null;
    }
  }, [mediaManager]);

  const setVideoFilter = useCallback(async (filter) => {
    setVideoFilterState(filter);
    const aiFilters = ['blur', 'blur-light', 'blur-heavy', 'studio', 'rocket', 'nature', 'moon', 'astronaut'];

    if (!aiFilters.includes(filter)) {
      videoProcessor.stopProcessing();
      if (rawStreamRef.current) {
        setLocalStream(rawStreamRef.current);
      }
    } else if (rawStreamRef.current) {
      const processed = await videoProcessor.start(rawStreamRef.current, filter, (updated) => {
        setLocalStream(updated);
      });
      if (processed) {
        setLocalStream(processed);
      }
    }
  }, []);

  return (
    <MediaContext.Provider value={{
      localStream,
      screenStream,
      audioEnabled,
      videoEnabled,
      screenSharing,
      isWatchPartyMode,
      devices,
      selectedCam,
      selectedMic,
      selectedSpeaker,
      audioLevel,
      videoFilter,
      setVideoFilter,
      mediaError,
      voiceFocusEnabled,
      toggleAudio,
      toggleVideo,
      toggleVoiceFocus,
      switchCamera,
      switchMicrophone,
      switchAudioOutput,
      testAudioOutput,
      startScreenShare,
      stopScreenShare,
      initMedia
    }}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be used within MediaProvider');
  return ctx;
}
