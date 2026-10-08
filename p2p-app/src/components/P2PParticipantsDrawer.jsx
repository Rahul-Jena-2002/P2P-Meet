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
  onChangeRole,
  onRemoveUser,
  onClose
}) {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [showMuteAllModal, setShowMuteAllModal] = useState(false);
  const [actionMenuPeerId, setActionMenuPeerId] = useState(null);

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
    <aside className="w-full sm:w-80 md:w-88 h-full bg-[#161324] border-l border-[rgba(196,181,253,0.14)] flex flex-col z-30 select-none shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-12 px-4 border-b border-[rgba(196,181,253,0.14)] flex items-center justify-between bg-[#161324]">
        <h3 className="text-xs font-bold text-[#F8F7FC] tracking-wide">
          Participants ({participants.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#C4B5FD]/60 hover:text-[#F8F7FC] hover:bg-[rgba(196,181,253,0.10)] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-[rgba(196,181,253,0.14)] bg-[#0D0B14]/60">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#C4B5FD]/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#0D0B14] border border-[rgba(196,181,253,0.18)] text-xs text-[#F8F7FC] placeholder-[#C4B5FD]/40 focus:outline-none focus:border-[#FF6B35]"
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
              className="group flex items-center justify-between p-2 rounded-xl hover:bg-[rgba(196,181,253,0.08)] border border-transparent hover:border-[rgba(196,181,253,0.10)] transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#221C35] to-[#2C2442] border border-[rgba(196,181,253,0.25)] flex items-center justify-center text-[#C4B5FD] text-xs font-bold shrink-0 shadow-sm">
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
                        className="px-2 py-0.5 rounded-lg bg-[#0D0B14] border border-[#FF6B35] text-xs text-[#F8F7FC]"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(p.id)}
                        className="p-1 rounded-lg bg-[#FF6B35] text-[#0D0B14] text-[10px] font-bold"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs font-medium text-[#F8F7FC] truncate">{p.name}</span>
                      {isMe && <span className="text-[10px] text-[#C4B5FD]/60">(Me)</span>}
                      {p.role === 'host' || p.isHost ? (
                        <span className="text-[9px] uppercase font-bold text-[#FFA14A] bg-[rgba(255,107,53,0.15)] border border-[#FF6B35]/30 px-1.5 py-0.2 rounded-md">
                          Host
                        </span>
                      ) : p.role === 'co-host' ? (
                        <span className="text-[9px] uppercase font-bold text-[#C4B5FD] bg-[rgba(196,181,253,0.15)] border border-[rgba(196,181,253,0.30)] px-1.5 py-0.2 rounded-md">
                          Co-Host
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Icons & Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 relative">
                {/* Hand Raised Badge */}
                {isHandUp && (
                  <button
                    onClick={() => onLowerHand?.(p.id)}
                    title={isHost || isMe ? "Click to Lower Hand" : "Hand Raised"}
                    className="p-1 rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] text-xs font-bold hover:scale-105 transition shadow-sm"
                  >
                    ✋
                  </button>
                )}

                {/* Mic & Video icons */}
                <div className="flex items-center gap-1 text-[#C4B5FD]/70">
                  {p.isAudioOn ? (
                    <Mic className="w-3.5 h-3.5 text-[#C4B5FD]" />
                  ) : (
                    <MicOff className="w-3.5 h-3.5 text-[#FF6B35]" />
                  )}
                  {p.isVideoOn ? (
                    <Video className="w-3.5 h-3.5 text-[#C4B5FD]" />
                  ) : (
                    <VideoOff className="w-3.5 h-3.5 text-[#C4B5FD]/40" />
                  )}
                </div>

                {/* Hover Rename Button */}
                {(isMe || isHost) && renamingId !== p.id && (
                  <button
                    onClick={() => handleStartRename(p)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[rgba(196,181,253,0.12)] text-[#C4B5FD]/70 hover:text-[#F8F7FC] transition"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}

                {/* Host Action Dropdown Trigger (More Options) */}
                {isHost && !isMe && (
                  <div className="relative">
                    <button
                      onClick={() => setActionMenuPeerId(actionMenuPeerId === p.id ? null : p.id)}
                      className="p-1 rounded-lg hover:bg-[rgba(196,181,253,0.12)] text-[#C4B5FD]/70 hover:text-[#F8F7FC] transition"
                      title="Participant Options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {actionMenuPeerId === p.id && (
                      <div className="absolute right-0 top-7 w-44 rounded-2xl bg-[#221C35] border border-[rgba(196,181,253,0.18)] p-1.5 text-xs shadow-2xl text-[#F8F7FC] z-50 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          onClick={() => {
                            onChangeRole?.(p.id, 'host');
                            setActionMenuPeerId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] text-[#FFA14A] font-medium transition flex items-center justify-between"
                        >
                          <span>Make Host</span>
                          <span className="text-[10px] text-white/40">👑</span>
                        </button>

                        <button
                          onClick={() => {
                            const newRole = p.role === 'co-host' ? 'participant' : 'co-host';
                            onChangeRole?.(p.id, newRole);
                            setActionMenuPeerId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] text-[#C4B5FD] font-medium transition flex items-center justify-between"
                        >
                          <span>{p.role === 'co-host' ? 'Remove Co-Host' : 'Make Co-Host'}</span>
                          <span className="text-[10px] text-white/40">⭐</span>
                        </button>

                        <div className="h-[1px] bg-[rgba(196,181,253,0.14)] my-1" />

                        <button
                          onClick={() => {
                            onRemoveUser?.(p.id);
                            setActionMenuPeerId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-red-500/20 text-[#FF6B35] font-medium transition flex items-center justify-between"
                        >
                          <span>Remove</span>
                          <span className="text-[10px] text-[#FF6B35]">✕</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Host Actions */}
      <div className="p-3 border-t border-[rgba(196,181,253,0.14)] bg-[#161324] flex items-center gap-2">
        <button
          onClick={handleInvite}
          className="flex-1 py-2 rounded-xl bg-[rgba(196,181,253,0.12)] hover:bg-[rgba(196,181,253,0.20)] text-[#F8F7FC] font-medium text-xs flex items-center justify-center gap-1.5 border border-[rgba(196,181,253,0.18)] transition shadow-sm"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#FFA14A]" /> : <UserPlus className="w-3.5 h-3.5 text-[#C4B5FD]" />}
          <span>{copied ? 'Link Copied' : 'Invite'}</span>
        </button>

        {isHost && (
          <button
            onClick={() => setShowMuteAllModal(true)}
            className="flex-1 py-2 rounded-xl bg-[rgba(255,107,53,0.15)] hover:bg-[#FF6B35] text-[#FFA14A] hover:text-[#0D0B14] font-bold text-xs flex items-center justify-center gap-1.5 border border-[#FF6B35]/35 transition shadow-sm"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Mute All</span>
          </button>
        )}
      </div>

      {/* Mute All Modal */}
      {showMuteAllModal && (
        <div className="fixed inset-0 z-50 bg-[#0D0B14]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#161324] border border-[rgba(196,181,253,0.20)] p-5 text-[#F8F7FC] shadow-2xl">
            <h4 className="text-sm font-bold text-[#F8F7FC] mb-2">Mute all current and new participants?</h4>
            <p className="text-xs text-[#C4B5FD]/70 mb-4">
              All participants will be muted. They will be notified that host has muted everyone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onMuteAll?.();
                  setShowMuteAllModal(false);
                }}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold text-xs shadow-md shadow-[#FF6B35]/20"
              >
                Mute All
              </button>
              <button
                onClick={() => setShowMuteAllModal(false)}
                className="flex-1 py-2 rounded-xl bg-[rgba(196,181,253,0.12)] hover:bg-[rgba(196,181,253,0.20)] text-[#F8F7FC] font-medium text-xs border border-[rgba(196,181,253,0.15)]"
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
