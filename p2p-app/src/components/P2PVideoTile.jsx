'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Pin, PinOff, Monitor, Shield, Volume2, Sparkles } from 'lucide-react';
import { useMedia } from './MediaProvider';

export default function P2PVideoTile({
  name,
  stream,
  isLocal = false,
  isHost = false,
  isAudioOn = true,
  isVideoOn = true,
  isScreenSharing = false,
  isSpeaking = false,
  isPinned = false,
  isHandRaised = false,
  isSingle = false,
  onPinToggle
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Zoom & Pan State (Full touchscreen gesture + desktop drag support)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Gesture tracking refs
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const touchStartDistRef = useRef(0);
  const touchStartZoomRef = useRef(1);
  const lastTapRef = useRef(0);

  let videoFilter = 'none';
  let selectedSpeaker = '';
  let isEffectLoading = false;
  let effectLoadingText = '';
  try {
    const media = useMedia();
    if (media) {
      videoFilter = media.videoFilter || 'none';
      selectedSpeaker = media.selectedSpeaker || '';
      isEffectLoading = media.isEffectLoading || false;
      effectLoadingText = media.effectLoadingText || '';
    }
  } catch (e) {}

  const getVideoFilterStyle = () => {
    if (!isLocal || isScreenSharing) return {};
    switch (videoFilter) {
      case 'noir':
        return { filter: 'grayscale(100%) contrast(1.2)' };
      case 'vivid':
        return { filter: 'saturate(1.4) contrast(1.1)' };
      case 'warm':
        return { filter: 'sepia(25%) saturate(1.2) brightness(1.03)' };
      case 'cinema':
        return { filter: 'contrast(1.15) brightness(0.95) saturate(1.15)' };
      case 'cyberpunk':
        return { filter: 'contrast(1.2) hue-rotate(-20deg) saturate(1.3)' };
      default:
        return {};
    }
  };

  // Video element binding & playback
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }

    const playVideo = () => {
      if (isVideoOn || isScreenSharing) {
        el.play().catch(e => console.warn('Video play error:', e));
      }
    };

    el.onloadedmetadata = playVideo;
    playVideo();

    stream.addEventListener('addtrack', playVideo);
    stream.getVideoTracks().forEach(t => {
      t.onunmute = playVideo;
    });

    return () => {
      stream.removeEventListener('addtrack', playVideo);
    };
  }, [stream, isVideoOn, isScreenSharing]);

  // Remote audio playback
  useEffect(() => {
    const ael = audioRef.current;
    if (!ael || !stream || isLocal) return;

    const playAudio = () => {
      try {
        if (ael.srcObject !== stream) {
          ael.srcObject = stream;
        }
        if (typeof ael.setSinkId === 'function' && selectedSpeaker) {
          ael.setSinkId(selectedSpeaker).catch(() => {});
        }
        const promise = ael.play();
        if (promise !== undefined) {
          promise.catch((e) => {
            console.warn('[Audio] Autoplay pending user interaction:', e.message);
          });
        }
      } catch (err) {
        console.warn('[Audio] Playback setup error:', err);
      }
    };

    playAudio();

    stream.addEventListener('addtrack', playAudio);
    stream.addEventListener('removetrack', playAudio);

    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach(track => {
      track.onunmute = playAudio;
    });

    return () => {
      stream.removeEventListener('addtrack', playAudio);
      stream.removeEventListener('removetrack', playAudio);
    };
  }, [stream, isLocal, selectedSpeaker]);

  // Autoplay unlock
  useEffect(() => {
    if (isLocal) return;
    const unlock = () => {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [isLocal]);

  // Clamp pan so video stays within container
  const clampPan = useCallback((newX, newY, currentZoom) => {
    if (currentZoom <= 1 || !containerRef.current) {
      return { x: 0, y: 0 };
    }
    const rect = containerRef.current.getBoundingClientRect();
    const maxPanX = (rect.width * (currentZoom - 1)) / 2;
    const maxPanY = (rect.height * (currentZoom - 1)) / 2;
    return {
      x: Math.min(maxPanX, Math.max(-maxPanX, newX)),
      y: Math.min(maxPanY, Math.max(-maxPanY, newY))
    };
  }, []);

  // Double-click / Double-tap zoom toggle
  const handleToggleZoom = (clientX, clientY) => {
    if (zoomLevel > 1) {
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
    } else {
      const targetZoom = 2.2;
      setZoomLevel(targetZoom);
      if (containerRef.current && clientX != null && clientY != null) {
        const rect = containerRef.current.getBoundingClientRect();
        const offsetX = (rect.left + rect.width / 2) - clientX;
        const offsetY = (rect.top + rect.height / 2) - clientY;
        setPan(clampPan(offsetX * 0.7, offsetY * 0.7, targetZoom));
      } else {
        setPan({ x: 0, y: 0 });
      }
    }
  };

  // Mouse drag handlers (Desktop)
  const handleMouseDown = (e) => {
    if (zoomLevel <= 1 || e.button !== 0) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || zoomLevel <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan(clampPan(panStartRef.current.x + dx, panStartRef.current.y + dy, zoomLevel));
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
    }
  };

  // Wheel zoom (Desktop smooth zoom)
  const handleWheel = (e) => {
    if (!containerRef.current) return;
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoomLevel(prev => {
      const next = Math.min(5, Math.max(1, +(prev + delta).toFixed(2)));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      setPan(currentPan => clampPan(currentPan.x, currentPan.y, next));
      return next;
    });
  };

  // Touch screen handlers (Pinch-to-zoom + Touch Drag + Double-tap)
  const handleTouchStart = (e) => {
    const now = Date.now();
    if (e.touches.length === 1) {
      if (now - lastTapRef.current < 320) {
        // Double tap: zoom in or reset to normal
        e.preventDefault();
        const touch = e.touches[0];
        handleToggleZoom(touch.clientX, touch.clientY);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (zoomLevel > 1) {
        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStartRef.current = { ...pan };
      }
    } else if (e.touches.length === 2) {
      // 2 fingers: pinch to zoom
      isDraggingRef.current = true;
      setIsDragging(true);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartZoomRef.current = zoomLevel;
      dragStartRef.current = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      panStartRef.current = { ...pan };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    if (e.touches.length === 1 && zoomLevel > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPan(clampPan(panStartRef.current.x + dx, panStartRef.current.y + dy, zoomLevel));
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (touchStartDistRef.current > 0) {
        const scale = currentDist / touchStartDistRef.current;
        const newZoom = Math.min(5, Math.max(1, +(touchStartZoomRef.current * scale).toFixed(2)));
        setZoomLevel(newZoom);

        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const dx = midX - dragStartRef.current.x;
        const dy = midY - dragStartRef.current.y;
        setPan(clampPan(panStartRef.current.x + dx, panStartRef.current.y + dy, newZoom));
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      isDraggingRef.current = false;
      setIsDragging(false);
      touchStartDistRef.current = 0;
      if (zoomLevel <= 1.05) {
        setZoomLevel(1);
        setPan({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && zoomLevel > 1) {
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
    }
  };

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <div
      ref={containerRef}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleToggleZoom(e.clientX, e.clientY);
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ touchAction: zoomLevel > 1 ? 'none' : 'auto' }}
      className={`relative w-full h-full overflow-hidden bg-[#0D0B14] flex items-center justify-center select-none group ${
        zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
      } ${
        isSingle
          ? 'rounded-none border-none'
          : `rounded-2xl border ${isSpeaking ? 'speaking-halo border-[#FF6B35] ring-2 ring-[#FF6B35] shadow-[0_0_14px_rgba(255,107,53,0.35)]' : 'border-white/10 shadow-xl'}`
      }`}
    >
      {/* Remote audio player */}
      {!isLocal && stream && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          muted={false}
          className="sr-only"
          style={{ position: 'fixed', top: -9999, left: -9999, width: '1px', height: '1px', opacity: 0.001, pointerEvents: 'none' }}
        />
      )}

      {/* Video stream element (Edge-to-Edge with Smooth Scale & Pan Dragging) */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          style={{
            ...getVideoFilterStyle(),
            transform: zoomLevel > 1
              ? `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`
              : undefined,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className={`w-full h-full ${isScreenSharing && zoomLevel === 1 ? 'object-contain' : 'object-cover'} bg-[#0D0B14] ${
            isLocal && !isScreenSharing && videoFilter === 'none' ? 'scale-x-[-1]' : ''
          } ${((isVideoOn || isScreenSharing) && (isLocal ? stream?.getVideoTracks()?.length > 0 : true)) ? 'block' : 'hidden'}`}
        />
      )}

      {/* Frosted Avatar when camera is off (Clean minimalist avatar, no redundant 'Camera off' text) */}
      {((!isVideoOn || (isLocal && stream?.getVideoTracks()?.length === 0)) && !isScreenSharing) && (
        <div className="flex flex-col items-center justify-center w-full h-full bg-[#0D0B14]">
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-[#221C35] to-[#2C2442] border border-[rgba(196,181,253,0.25)] backdrop-blur-xl flex items-center justify-center text-[#C4B5FD] text-xl sm:text-2xl font-bold shadow-xl">
            {initials}
          </div>
        </div>
      )}

      {/* Zoom level indicator badge (When zoomed in) - 50% Translucent with Thin Orange Border */}
      {zoomLevel > 1 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none px-3.5 py-1 rounded-full bg-[#0D0B14]/50 border border-[#FF6B35]/70 backdrop-blur-xl text-[10px] text-[#FFA14A] font-semibold shadow-md z-20 animate-in fade-in duration-150">
          {zoomLevel.toFixed(1)}x • Drag to pan • Double-tap to reset
        </div>
      )}

      {/* Google Meet-Style Centered Hover Action Overlay (Pin / Unpin) */}
      {onPinToggle && !isEffectLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPinToggle();
            }}
            className={`pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-full backdrop-blur-2xl border text-xs font-semibold shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
              isPinned
                ? 'bg-[#FF6B35] text-[#0D0B14] border-[#FF6B35] hover:bg-[#FFA14A]'
                : 'bg-white/20 hover:bg-white/35 text-white border-white/30'
            }`}
            title={isPinned ? 'Unpin from main screen' : 'Pin to main screen'}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            <span>{isPinned ? 'Unpin' : 'Pin'}</span>
          </button>
        </div>
      )}

      {/* AI Model Loading & Face Alignment Floating Pill Overlay */}
      {isLocal && isEffectLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full ios-glass-pill shadow-xl text-xs font-semibold text-white pointer-events-auto">
            <div className="w-3.5 h-3.5 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{effectLoadingText || 'Aligning Face & Loading AI Effect...'}</span>
          </div>
        </div>
      )}

      {/* Top Indicators - Only on non-single grid tiles, never on full-screen hero stage to avoid header overlap */}
      {!isSingle && (
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-1.5">
            {isHandRaised && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF6B35]/90 text-[#0D0B14] text-[10px] font-bold shadow-sm backdrop-blur-xl border border-[#FF6B35] animate-bounce">
                <span>✋ Raised</span>
              </div>
            )}
            {isScreenSharing && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-[#C4B5FD] text-[10px] font-bold backdrop-blur-xl border border-white/15">
                <Monitor className="w-3 h-3 text-[#FF6B35]" />
                <span>Screen</span>
              </div>
            )}
          </div>

          {/* Signal health meter */}
          <div
            className="flex items-end gap-[2px] px-1.5 py-1 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 ml-auto"
            title="P2P Connection Quality (STUN: Excellent)"
          >
            <span className="w-[2px] h-1 rounded-sm bg-emerald-400" />
            <span className="w-[2px] h-2 rounded-sm bg-emerald-400" />
            <span className="w-[2px] h-3 rounded-sm bg-emerald-400" />
          </div>
        </div>
      )}

      {/* Bottom Left Name tag with audio icon and status badges */}
      {!(isScreenSharing && isSingle) && (
        <div className="absolute bottom-2.5 left-2.5 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[#F8F7FC] text-xs font-medium border border-white/10 shadow-md z-20">
          <div className="shrink-0">
            {isAudioOn ? (
              <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-[#FF6B35] animate-pulse' : 'text-[#C4B5FD]'}`} />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-[#FF6B35]" />
            )}
          </div>
          <span className="truncate max-w-[120px] font-medium text-[11px] text-white/90">{name} {isLocal && '(You)'}</span>
          {isPinned && (
            <Pin className="w-3 h-3 text-[#FFA14A] fill-[#FFA14A] shrink-0" title="Pinned" />
          )}
          {isHandRaised && (
            <span className="text-[10px]">✋</span>
          )}
          {isHost && (
            <span className="text-[9px] uppercase font-bold text-[#FFA14A] bg-[#FF6B35]/25 border border-[#FF6B35]/40 px-1.5 py-0.5 rounded shadow-sm">
              HOST
            </span>
          )}
        </div>
      )}
    </div>
  );
}
