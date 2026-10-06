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
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#121620] border transition-all duration-300 flex items-center justify-center group select-none shadow-2xl ${
        isSpeaking ? 'speaking-halo border-blue-500' : 'border-slate-800/80 hover:border-slate-700/80'
      }`}
    >
      {/* Video stream (shows if video is on OR screen is sharing) */}
      {(isVideoOn || isScreenSharing) && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-contain bg-black ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        /* Sleek Avatar when camera is off */
        <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-b from-[#161a26] to-[#0d1017]">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white text-3xl font-extrabold shadow-2xl shadow-blue-500/20 mb-3 border border-white/10">
            {initials}
          </div>
          <span className="text-slate-300 text-sm font-semibold tracking-wide">{name}</span>
          {!isVideoOn && (
            <span className="text-slate-500 text-xs mt-0.5">Camera off</span>
          )}
        </div>
      )}

      {/* Screen Sharing Indicator */}
      {isScreenSharing && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-semibold backdrop-blur-md shadow-lg border border-emerald-400/30">
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
          className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-slate-300 hover:text-white hover:bg-black/90 transition backdrop-blur-md opacity-0 group-hover:opacity-100 border border-white/10 shadow-lg"
        >
          {isPinned ? <PinOff className="w-4 h-4 text-blue-400" /> : <Pin className="w-4 h-4" />}
        </button>
      )}

      {/* Bottom Name & Audio Status Strip */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {/* Name pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-white text-xs font-semibold border border-white/10 shadow-md">
          {isSpeaking && <Volume2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />}
          <span>{name} {isLocal && '(You)'}</span>
          {isHost && (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded">
              <Shield className="w-2.5 h-2.5" /> Host
            </span>
          )}
        </div>

        {/* Mic status icon */}
        <div className={`p-1.5 rounded-xl backdrop-blur-md border border-white/10 ${
          isAudioOn ? 'bg-black/60 text-slate-300' : 'bg-red-600/90 text-white shadow-lg shadow-red-600/30'
        }`}>
          {isAudioOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
}
