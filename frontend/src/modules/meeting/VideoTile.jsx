/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Pin, PinOff, Monitor, Shield } from 'lucide-react';
import { useMeetingStore } from '../webrtc/useMeetingStore';
import { webrtcManager } from '../webrtc/WebRtcManager';

export default function VideoTile({
  participantId,
  displayName,
  stream,
  isLocal = false,
  isHost = false,
  audioEnabled = true,
  videoEnabled = true,
  screenSharing = false,
  isPinned = false,
  isActiveSpeaker = false,
  onPinToggle,
}) {
  const videoRef = useRef(null);
  const { remoteControl } = useMeetingStore();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const isBeingControlledByMe = remoteControl.isControlling && remoteControl.targetPeerId === participantId;

  const handleMouseMove = (e) => {
    if (!isBeingControlledByMe || !videoRef.current) return;
    const rect = videoRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    webrtcManager.sendControlEvent(participantId, 'mouse_move', { x, y });
  };

  const handleClick = (e) => {
    if (!isBeingControlledByMe || !videoRef.current) return;
    const rect = videoRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    webrtcManager.sendControlEvent(participantId, 'mouse_click', { x, y, button: 'left' });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className={`relative rounded-2xl overflow-hidden bg-dark-800 border transition-all duration-300 group flex items-center justify-center select-none shadow-xl ${
        isActiveSpeaker ? 'active-speaker border-blue-500' : 'border-slate-800/80 hover:border-slate-700'
      } ${isPinned ? 'w-full h-full' : 'w-full h-full min-h-[220px]'}`}
    >
      {/* Video Element */}
      {videoEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLocal && !screenSharing ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        /* Avatar Placeholder when video is off */
        <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-dark-800 to-dark-900">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/20 mb-2">
            {initials}
          </div>
          <span className="text-slate-400 text-sm font-medium">{displayName}</span>
        </div>
      )}

      {/* Screen Sharing Badge */}
      {screenSharing && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/90 text-white text-xs font-semibold backdrop-blur-md shadow-md">
          <Monitor className="w-3.5 h-3.5" />
          <span>Screen Sharing</span>
        </div>
      )}

      {/* Remote Control Badge */}
      {isBeingControlledByMe && (
        <div className="absolute top-3 right-12 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-semibold backdrop-blur-md shadow-md animate-pulse">
          <span>Controlling Remote Screen</span>
        </div>
      )}

      {/* Pin Tile Button */}
      {onPinToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPinToggle(participantId);
          }}
          title={isPinned ? "Unpin tile" : "Pin tile"}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/50 text-slate-300 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
        >
          {isPinned ? <PinOff className="w-4 h-4 text-blue-400" /> : <Pin className="w-4 h-4" />}
        </button>
      )}

      {/* Bottom Info Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-medium border border-white/5 shadow-sm">
          <span>{displayName} {isLocal && '(You)'}</span>
          {isHost && (
            <span className="flex items-center gap-0.5 text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
              <Shield className="w-2.5 h-2.5" /> Host
            </span>
          )}
        </div>

        <div className={`p-1.5 rounded-lg backdrop-blur-md border border-white/5 ${
          audioEnabled ? 'bg-black/60 text-slate-300' : 'bg-red-500/80 text-white shadow-lg shadow-red-500/20'
        }`}>
          {audioEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
}
