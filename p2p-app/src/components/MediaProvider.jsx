'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { videoProcessor } from '../lib/videoProcessor';

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

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const rawStreamRef = useRef(null);

  // Initialize or re-acquire user media
  const initMedia = useCallback(async (camId, micId) => {
    try {
      setMediaError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMediaError("Mobile browsers restrict camera/mic on HTTP. You can still join to view, chat, and watch!");
        setVideoEnabled(false);
        setAudioEnabled(false);
        return null;
      }
      // Stop existing tracks safely
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints = {
        video: camId ? { deviceId: { exact: camId } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: micId ? { deviceId: { exact: micId } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      rawStreamRef.current = stream;

      // Track enabled states
      stream.getAudioTracks().forEach(t => { t.enabled = audioEnabled; });
      stream.getVideoTracks().forEach(t => { t.enabled = videoEnabled; });

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

      // Enumerate available hardware devices (cameras, microphones, and audio output speakers)
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = deviceList.filter(d => d.kind === 'videoinput');
        const audioDevs = deviceList.filter(d => d.kind === 'audioinput');
        const audioOutDevs = deviceList.filter(d => d.kind === 'audiooutput');
        setDevices({ video: videoDevs, audio: audioDevs, audioOutput: audioOutDevs });

        if (!selectedCam && videoDevs.length > 0) setSelectedCam(videoDevs[0].deviceId);
        if (!selectedMic && audioDevs.length > 0) setSelectedMic(audioDevs[0].deviceId);

        // Retrieve and restore saved speaker device
        if (audioOutDevs.length > 0) {
          const savedSpeaker = typeof localStorage !== 'undefined' ? localStorage.getItem('p2pmeet_selected_speaker') : null;
          const match = audioOutDevs.find(d => d.deviceId === savedSpeaker);
          setSelectedSpeaker(match ? match.deviceId : audioOutDevs[0].deviceId);
        }
      } catch (err) {
        console.warn('Could not enumerate devices:', err);
      }

      // Audio volume analyzer for speaking detection and meter
      if (stream.getAudioTracks().length > 0) {
        setupAudioAnalyzer(stream);
      }

      return stream;
    } catch (err) {
      console.warn('Camera/Mic permission notice:', err);
      setMediaError("Camera/Mic not available on this connection. Joining in Viewer mode.");
      setVideoEnabled(false);
      setAudioEnabled(false);
      return null;
    }
  }, [audioEnabled, videoEnabled, selectedCam, selectedMic, videoFilter]);

  // Audio level analyzer loop
  const setupAudioAnalyzer = (stream) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (err) {
      console.warn('Audio analyzer error:', err);
    }
  };

  useEffect(() => {
    initMedia();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const next = !audioEnabled;
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
      setAudioEnabled(next);
      return next;
    }
    return false;
  }, [audioEnabled]);

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const next = !videoEnabled;
      streamRef.current.getVideoTracks().forEach(t => { t.enabled = next; });
      setVideoEnabled(next);
      return next;
    }
    return false;
  }, [videoEnabled]);

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

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });
      setScreenStream(stream);
      setScreenSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      return stream;
    } catch (err) {
      console.warn('Screen share canceled:', err);
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    setScreenStream(null);
    setScreenSharing(false);
  }, [screenStream]);

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
      devices,
      selectedCam,
      selectedMic,
      selectedSpeaker,
      audioLevel,
      videoFilter,
      setVideoFilter,
      mediaError,
      toggleAudio,
      toggleVideo,
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
