'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Pin, PinOff, Monitor, Shield, Volume2 } from 'lucide-react';

export default function ZoomVideoTile({
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
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#242424] border transition-all duration-300 flex items-center justify-center group select-none shadow-2xl ${
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
          className={`w-full h-full object-contain bg-[#1C1C1C] ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        /* Sleek Warm Avatar when camera is off */
        <div className="flex flex-col items-center justify-center w-full h-full bg-[#242424]">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#FF6F61] via-[#FF6F61] to-[#DAA520] flex items-center justify-center text-[#1C1C1C] text-2xl font-black shadow-xl shadow-[#FF6F61]/15 mb-2.5 border border-[#F5E8D8]/20">
            {initials}
          </div>
          <span className="text-[#F5E8D8] text-sm font-semibold tracking-tight">{name}</span>
          {!isVideoOn && (
            <span className="text-[#F5E8D8]/45 text-xs mt-0.5 font-medium">Camera off</span>
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
