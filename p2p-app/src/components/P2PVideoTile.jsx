'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useEffect, useRef } from 'react';
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
  onPinToggle
}) {
  const videoRef = useRef(null);
  let videoFilter = 'none';
  try {
    const media = useMedia();
    if (media) videoFilter = media.videoFilter || 'none';
  } catch (e) {}

  const getVideoFilterStyle = () => {
    if (!isLocal || isScreenSharing) return {};
    switch (videoFilter) {
      case 'blur-light':
        return { filter: 'blur(5px)' };
      case 'blur-heavy':
        return { filter: 'blur(12px)' };
      case 'noir':
        return { filter: 'grayscale(100%) contrast(1.25)' };
      case 'vivid':
        return { filter: 'saturate(1.5) contrast(1.12)' };
      case 'warm':
        return { filter: 'sepia(32%) saturate(1.25) brightness(1.04)' };
      case 'cinema':
        return { filter: 'contrast(1.18) brightness(0.92) saturate(1.18)' };
      case 'sepia':
        return { filter: 'sepia(80%) contrast(1.08)' };
      case 'studio':
        return { filter: 'contrast(1.1) brightness(1.06) saturate(1.22)' };
      case 'cyberpunk':
        return { filter: 'contrast(1.22) hue-rotate(-25deg) saturate(1.35)' };
      default:
        return {};
    }
  };

  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.onloadedmetadata = () => {
        el.play().catch(e => console.warn('Video play error:', e));
      };
      el.play().catch(e => console.warn('Video play error:', e));
    }
  }, [stream, isVideoOn, isScreenSharing]);

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#242424] border transition-all duration-200 flex items-center justify-center group select-none ${
        isSpeaking ? 'speaking-halo border-[#FF6F61]' : 'border-[#F5E8D8]/10 hover:border-[#F5E8D8]/20'
      }`}
    >
      {/* Video stream (shows if video is on OR screen is sharing) */}
      {(isVideoOn || isScreenSharing) && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={getVideoFilterStyle()}
          className={`w-full h-full ${isScreenSharing ? 'object-contain' : 'object-cover'} bg-[#1C1C1C] transition-all duration-300 ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        /* Minimal Warm Avatar when camera is off */
        <div className="flex flex-col items-center justify-center w-full h-full bg-[#202020]">
          <div className="w-18 h-18 rounded-full bg-[#2D2D2D] border border-[#F5E8D8]/15 flex items-center justify-center text-[#F5E8D8] text-xl font-bold mb-2">
            {initials}
          </div>
          <span className="text-[#F5E8D8] text-sm font-medium">{name}</span>
          {!isVideoOn && (
            <span className="text-[#F5E8D8]/40 text-xs mt-0.5">Camera off</span>
          )}
        </div>
      )}

      {/* Screen Sharing Indicator */}
      {isScreenSharing && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6F61] text-[#1C1C1C] text-xs font-bold backdrop-blur-md shadow-lg border border-[#FF6F61]/30">
          <Monitor className="w-3.5 h-3.5" />
          <span>Screen Sharing</span>
        </div>
      )}

      {/* Pin toggle button on hover */}
      {onPinToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPinToggle();
          }}
          title={isPinned ? "Unpin video" : "Pin video"}
          className="absolute top-3 right-3 p-2 rounded-xl bg-[#1C1C1C]/80 text-[#F5E8D8] hover:text-[#FF6F61] hover:bg-[#1C1C1C] transition backdrop-blur-md opacity-0 group-hover:opacity-100 border border-[#F5E8D8]/10 shadow-lg"
        >
          {isPinned ? <PinOff className="w-4 h-4 text-[#FF6F61]" /> : <Pin className="w-4 h-4" />}
        </button>
      )}

      {/* Bottom Name & Audio Status Strip */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {/* Name pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1C1C1C]/80 backdrop-blur-md text-[#F5E8D8] text-xs font-semibold border border-[#F5E8D8]/10 shadow-md">
          {isSpeaking && <Volume2 className="w-3.5 h-3.5 text-[#DAA520] animate-pulse" />}
          <span>{name} {isLocal && '(You)'}</span>
          {isHost && (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-[#DAA520] bg-[#DAA520]/15 border border-[#DAA520]/25 px-1.5 py-0.5 rounded">
              <Shield className="w-2.5 h-2.5" /> Host
            </span>
          )}
        </div>

        {/* Mic status icon */}
        <div className={`p-1.5 rounded-xl backdrop-blur-md border border-[#F5E8D8]/10 ${
          isAudioOn ? 'bg-[#1C1C1C]/80 text-[#DAA520]' : 'bg-[#FF4500] text-white shadow-lg shadow-[#FF4500]/25'
        }`}>
          {isAudioOn ? <Mic className="w-3.5 h-3.5 text-[#DAA520]" /> : <MicOff className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
}
