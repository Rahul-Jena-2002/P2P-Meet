'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
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
  onPinToggle
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = normal fit, 1.6 = zoom in

  let videoFilter = 'none';
  let selectedSpeaker = '';
  try {
    const media = useMedia();
    if (media) {
      videoFilter = media.videoFilter || 'none';
      selectedSpeaker = media.selectedSpeaker || '';
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

  // Dedicated remote audio player: Guarantees audio plays reliably even if video is off or minimized!
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

    // Re-trigger playback if audio track was added dynamically after initial mount
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

  // Autoplay permission unlock: Play audio on first user gesture anywhere
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

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        onPinToggle?.();
      }}
      className={`relative w-full h-full rounded-xl overflow-hidden bg-[#1E1E22] border-2 transition-all duration-200 flex items-center justify-center group select-none ${
        isSpeaking
          ? 'border-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.5)] ring-2 ring-[#10B981]/40'
          : 'border-white/5 hover:border-white/15'
      }`}
    >
      {/* Dedicated always-on audio stream player for remote peers: MUST NOT use display: none! */}
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

      {/* Video stream element: Always muted to avoid dual audio sink conflicts with dedicated audio element */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          style={{
            ...getVideoFilterStyle(),
            transform: zoomLevel > 1 ? `scale(${zoomLevel})` : undefined,
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className={`w-full h-full ${isScreenSharing && zoomLevel === 1 ? 'object-contain' : 'object-cover'} bg-[#1C1C1C] transition-all duration-300 ${
            isLocal && !isScreenSharing && videoFilter === 'none' ? 'scale-x-[-1]' : ''
          } ${((isVideoOn || isScreenSharing) && (isLocal ? stream?.getVideoTracks()?.length > 0 : true)) ? 'block' : 'hidden'}`}
        />
      )}

      {/* Warm Avatar when camera is off or has no video tracks */}
      {((!isVideoOn || (isLocal && stream?.getVideoTracks()?.length === 0)) && !isScreenSharing) && (
        <div className="flex flex-col items-center justify-center w-full h-full bg-[#18181B]">
          <div className="w-18 h-18 rounded-full bg-[#27272A] border border-white/15 flex items-center justify-center text-white text-xl font-bold mb-2 shadow-inner">
            {initials}
          </div>
          <span className="text-white text-sm font-medium">{name}</span>
          {!isVideoOn && (
            <span className="text-white/40 text-xs mt-0.5">Camera off</span>
          )}
          {isVideoOn && isLocal && stream?.getVideoTracks()?.length === 0 && (
            <span className="text-amber-400/80 text-[11px] mt-0.5">Camera in use by another app</span>
          )}
        </div>
      )}

      {/* Top Indicators & Quick Action Controls */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-20">
        {/* Left side: Hand Raised / Screen Sharing / Pinned indicator */}
        <div className="flex items-center gap-1.5">
          {isHandRaised && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-black text-[11px] font-bold shadow-lg border border-amber-300 animate-bounce">
              <span>✋ Hand Raised</span>
            </div>
          )}
          {isScreenSharing && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0E72ED] text-white text-[11px] font-bold backdrop-blur-md shadow-md border border-[#0E72ED]/50">
              <Monitor className="w-3 h-3" />
              <span>Screen</span>
            </div>
          )}
          {isPinned && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#107C41] text-white text-[11px] font-bold backdrop-blur-md shadow-md border border-emerald-500/40">
              <Pin className="w-3 h-3 fill-current" />
              <span>Pinned</span>
            </div>
          )}
        </div>

        {/* Right side: Zoom and Pin buttons */}
        <div className="flex items-center gap-1 pointer-events-auto opacity-0 group-hover:opacity-100 sm:transition-opacity transition-all duration-150">
          {/* Zoom toggle button */}
          {(isVideoOn || isScreenSharing) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel(z => z === 1 ? 1.6 : 1);
              }}
              title={zoomLevel > 1 ? "Zoom 100% Fit" : "Zoom In Focus (1.6x)"}
              className={`p-1.5 rounded-lg backdrop-blur-md border transition text-xs shadow-md ${
                zoomLevel > 1
                  ? 'bg-[#0E72ED] text-white border-[#0E72ED]'
                  : 'bg-black/70 text-white hover:text-[#0E72ED] border-white/10'
              }`}
            >
              {zoomLevel > 1 ? '1x' : '🔍 +'}
            </button>
          )}

          {/* Pin toggle button */}
          {onPinToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPinToggle();
              }}
              title={isPinned ? "Unpin video (Back to Grid)" : "Pin video to Main Stage (or Double-Click)"}
              className={`p-1.5 rounded-lg backdrop-blur-md border transition shadow-md ${
                isPinned
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-black/70 text-white hover:text-emerald-400 border-white/10'
              }`}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Left Zoom-style Name tag with audio icon */}
      <div className="absolute bottom-2.5 left-2.5 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-white text-xs font-medium border border-white/10 shadow-md">
        <div className="shrink-0">
          {isAudioOn ? (
            <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-emerald-400 animate-pulse' : 'text-white/80'}`} />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-red-500" />
          )}
        </div>
        <span className="truncate max-w-[130px]">{name} {isLocal && '(You)'}</span>
        {isHost && (
          <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-1 rounded">
            Host
          </span>
        )}
      </div>
    </div>
  );
}
