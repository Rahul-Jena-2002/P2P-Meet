'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, Shield, UserPlus, VolumeX, Check } from 'lucide-react';

export default function P2PParticipantsDrawer({
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
    <aside className="w-80 sm:w-96 h-full p2p-panel border-l border-[#F5E8D8]/10 flex flex-col z-30 animate-in slide-in-from-right duration-200 select-none bg-[#1C1C1C]/95 text-[#F5E8D8]">
      {/* Header */}
      <div className="p-4 border-b border-[#F5E8D8]/10 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#F5E8D8]/70">
          Participants ({participants.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#F5E8D8]/50 hover:text-[#F5E8D8] hover:bg-[#F5E8D8]/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#242424]/80 hover:bg-[#242424] border border-[#F5E8D8]/10 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF6F61] to-[#DAA520] flex items-center justify-center text-[#1C1C1C] text-xs font-bold shrink-0 shadow-sm">
                {p.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-[#F5E8D8] truncate">{p.name}</span>
                  {p.isHost && (
                    <span className="flex items-center gap-0.5 text-[9px] uppercase font-bold text-[#DAA520] bg-[#DAA520]/15 border border-[#DAA520]/30 px-1.5 py-0.5 rounded-md">
                      <Shield className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 text-[#F5E8D8]/50">
              {p.isAudioOn ? <Mic className="w-4 h-4 text-[#DAA520]" /> : <MicOff className="w-4 h-4 text-[#FF4500]" />}
              {p.isVideoOn ? <Video className="w-4 h-4 text-[#DAA520]" /> : <VideoOff className="w-4 h-4 text-[#F5E8D8]/30" />}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Host Actions */}
      <div className="p-3 border-t border-[#F5E8D8]/10 bg-[#1C1C1C]/90 flex items-center gap-2">
        <button
          onClick={handleInvite}
          className="flex-1 py-2 rounded-xl bg-[#F5E8D8]/10 hover:bg-[#FF4500] hover:text-[#1C1C1C] text-[#F5E8D8] font-medium text-xs flex items-center justify-center gap-1.5 border border-[#F5E8D8]/15 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#DAA520]" /> : <UserPlus className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied Link' : 'Invite'}</span>
        </button>

        {isHost && (
          <button
            onClick={onMuteAll}
            className="flex-1 py-2 rounded-xl bg-[#FF4500]/15 hover:bg-[#FF4500]/25 text-[#FF6F61] font-medium text-xs flex items-center justify-center gap-1.5 border border-[#FF6F61]/30 transition"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Mute All</span>
          </button>
        )}
      </div>
    </aside>
  );
}
