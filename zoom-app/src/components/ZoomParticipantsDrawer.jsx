'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, Shield, UserPlus, VolumeX, Check } from 'lucide-react';

export default function ZoomParticipantsDrawer({
  participants,
  isHost,
  roomCode,
  onMuteAll,
  onClose
}) {
  const [copied, setCopied] = React.useState(false);

  const handleInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}?code=${roomCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-80 sm:w-96 h-full zoom-panel border-l border-white/10 flex flex-col z-30 animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wide">
          Participants ({participants.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {p.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200 truncate">{p.name}</span>
                  {p.isHost && (
                    <span className="flex items-center gap-0.5 text-[9px] uppercase font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded">
                      <Shield className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-slate-400">
              {p.isAudioOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
              {p.isVideoOn ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-slate-500" />}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Host Actions (Zoom Style) */}
      <div className="p-3 border-t border-white/10 bg-black/20 flex items-center gap-2">
        <button
          onClick={handleInvite}
          className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <UserPlus className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied Link' : 'Invite'}</span>
        </button>

        {isHost && (
          <button
            onClick={onMuteAll}
            className="flex-1 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-red-500/30 transition"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Mute All</span>
          </button>
        )}
      </div>
    </aside>
  );
}
