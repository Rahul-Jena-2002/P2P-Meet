'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Pixel-Perfect Zoom Participants Sidebar
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
import {
  X, Mic, MicOff, Video, VideoOff, Shield, UserPlus,
  VolumeX, Check, Search, Hand, MoreVertical, Edit2, Lock
} from 'lucide-react';

export default function P2PParticipantsDrawer({
  participants = [],
  currentUserId,
  isHost = false,
  roomCode,
  raisedHands = [],
  onLowerHand,
  onMuteAll,
  onRenameUser,
  onClose
}) {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [showMuteAllModal, setShowMuteAllModal] = useState(false);

  const handleInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}?code=${roomCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sort: 1) Host, 2) Raised Hands, 3) Self, 4) Others
  const sorted = [...participants].sort((a, b) => {
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    const aHand = raisedHands.includes(a.id);
    const bHand = raisedHands.includes(b.id);
    if (aHand && !bHand) return -1;
    if (!aHand && bHand) return 1;
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return a.name.localeCompare(b.name);
  });

  const filtered = sorted.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleStartRename = (p) => {
    setRenamingId(p.id);
    setRenameText(p.name);
  };

  const handleSaveRename = (id) => {
    if (renameText.trim()) {
      onRenameUser?.(id, renameText.trim());
    }
    setRenamingId(null);
  };

  return (
    <aside className="w-full sm:w-80 md:w-88 h-full bg-[#1F1F23] border-l border-white/10 flex flex-col z-30 select-none shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between bg-[#232326]">
        <h3 className="text-xs font-bold text-white tracking-wide">
          Participants ({participants.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-white/10 bg-[#1A1A1E]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#27272A] border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#0E72ED]"
          />
        </div>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((p) => {
          const isHandUp = raisedHands.includes(p.id);
          const isMe = p.id === currentUserId;

          return (
            <div
              key={p.id}
              className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-[#0E72ED] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {p.name[0]?.toUpperCase() || 'U'}
                </div>

                {/* Name & Badges */}
                <div className="min-w-0">
                  {renamingId === p.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(p.id)}
                        className="px-1.5 py-0.5 rounded bg-black/60 border border-[#0E72ED] text-xs text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(p.id)}
                        className="p-1 rounded bg-[#0E72ED] text-white text-[10px]"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs font-medium text-white truncate">{p.name}</span>
                      {isMe && <span className="text-[10px] text-white/50">(Me)</span>}
                      {p.isHost && (
                        <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-400/15 border border-amber-400/25 px-1 py-0.2 rounded">
                          Host
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Icons & Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Hand Raised Badge */}
                {isHandUp && (
                  <button
                    onClick={() => onLowerHand?.(p.id)}
                    title={isHost || isMe ? "Click to Lower Hand" : "Hand Raised"}
                    className="p-1 rounded bg-amber-400 text-black text-xs font-bold hover:scale-105 transition"
                  >
                    ✋
                  </button>
                )}

                {/* Mic & Video icons */}
                <div className="flex items-center gap-1 text-white/70">
                  {p.isAudioOn ? (
                    <Mic className="w-3.5 h-3.5 text-white/80" />
                  ) : (
                    <MicOff className="w-3.5 h-3.5 text-red-500" />
                  )}
                  {p.isVideoOn ? (
                    <Video className="w-3.5 h-3.5 text-white/80" />
                  ) : (
                    <VideoOff className="w-3.5 h-3.5 text-white/30" />
                  )}
                </div>

                {/* Hover Rename Button */}
                {(isMe || isHost) && renamingId !== p.id && (
                  <button
                    onClick={() => handleStartRename(p)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Host Actions (Zoom Style) */}
      <div className="p-3 border-t border-white/10 bg-[#232326] flex items-center gap-2">
        <button
          onClick={handleInvite}
          className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <UserPlus className="w-3.5 h-3.5" />}
          <span>{copied ? 'Link Copied' : 'Invite'}</span>
        </button>

        {isHost && (
          <button
            onClick={() => setShowMuteAllModal(true)}
            className="flex-1 py-2 rounded-lg bg-[#E02828]/15 hover:bg-[#E02828] text-red-400 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 border border-red-500/30 transition"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Mute All</span>
          </button>
        )}
      </div>

      {/* Mute All Modal */}
      {showMuteAllModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-[#232326] border border-white/15 p-5 text-white shadow-2xl">
            <h4 className="text-sm font-bold text-white mb-2">Mute all current and new participants?</h4>
            <p className="text-xs text-white/60 mb-4">
              All participants will be muted. They will be notified that host has muted everyone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onMuteAll?.();
                  setShowMuteAllModal(false);
                }}
                className="flex-1 py-2 rounded-lg bg-[#0E72ED] hover:bg-[#005CE6] text-white font-bold text-xs"
              >
                Mute All
              </button>
              <button
                onClick={() => setShowMuteAllModal(false)}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
