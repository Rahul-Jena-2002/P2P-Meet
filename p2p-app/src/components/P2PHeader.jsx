'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Pixel-Perfect Zoom Header & Meeting Info Modal
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, LayoutGrid, Maximize2, Minimize2, Copy,
  Check, Clock, Users, Lock, ChevronDown, Radio, Circle, X
} from 'lucide-react';

export default function P2PHeader({
  title = 'Zoom Meeting',
  roomCode,
  hostName = 'Host',
  isHost = false,
  onLeave,
  viewMode = 'gallery',
  onToggleViewMode,
  isRecording = false,
  onStopRecording,
  onToggleWhiteboard,
  isVisible = true,
  isMobile = false,
  isMobileLandscape = false,
  networkStats,
  topologyMode = 'mesh',
  isSupernode = false
}) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef(null);
  const viewMenuRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close popups on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target) && !e.target.closest('#zoom-info-btn')) {
        setShowInfoModal(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target) && !e.target.closest('#zoom-view-btn')) {
        setShowViewDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getInviteLink = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}?code=${roomCode}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getInviteLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className={`absolute top-0 left-0 right-0 h-11 px-3 z-30 flex items-center justify-between select-none bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-200 ${
      isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
    }`}>
      {/* 1. LEFT: Iconic Zoom Green Shield (Meeting Info) + Recording Badge */}
      <div className="flex items-center gap-2 relative">
        <button
          id="zoom-info-btn"
          onClick={() => setShowInfoModal(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition text-xs font-medium border ${
            showInfoModal
              ? 'bg-[#107C41] text-white border-[#107C41]'
              : 'bg-black/40 hover:bg-black/60 text-emerald-400 hover:text-emerald-300 border-white/10'
          }`}
          title="Meeting Information (Zoom Security Shield)"
        >
          <ShieldCheck className="w-4 h-4 fill-emerald-500/20 text-emerald-400" />
          <span className="hidden sm:inline font-medium text-white/90">{title}</span>
        </button>

        {/* Network Topology Badge */}
        <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
          topologyMode === 'relay-tree'
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        }`} title={topologyMode === 'relay-tree' ? 'Decentralized Relay SFU tree' : 'Zero latency Full Mesh connection'}>
          <span className={`w-1.5 h-1.5 rounded-full ${topologyMode === 'relay-tree' ? 'bg-blue-400' : 'bg-emerald-400'} animate-pulse`} />
          <span>{topologyMode === 'relay-tree' ? (isSupernode ? 'Supernode Host' : 'Relay Tree') : 'Direct Mesh'}</span>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600/90 text-white text-xs font-semibold shadow animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>● Recording</span>
            {onStopRecording && (
              <button
                onClick={onStopRecording}
                className="ml-1 px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/70 text-[10px] text-white"
                title="Stop Recording"
              >
                Stop
              </button>
            )}
          </div>
        )}

        {/* Zoom Meeting Info Popup */}
        {showInfoModal && (
          <div
            ref={modalRef}
            className="absolute top-12 left-0 w-80 sm:w-96 rounded-xl bg-[#232326] border border-white/15 p-4 text-xs shadow-2xl text-white/90 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-bold text-sm text-white">{title || 'Zoom Meeting'}</h4>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-md hover:bg-white/10 text-white/50 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 font-sans">
              <div className="flex items-center justify-between py-1">
                <span className="text-white/50">Meeting ID:</span>
                <span className="font-mono font-bold tracking-wider text-white text-[13px]">{roomCode}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-white/50">Host:</span>
                <span className="font-medium text-white">{hostName}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-white/50">Passcode:</span>
                <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white font-semibold">2026</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-white/50">Topology:</span>
                <span className="font-semibold text-white">
                  {topologyMode === 'relay-tree' ? 'Decentralized Relay SFU' : 'Direct Full Mesh (P2P)'}
                  {isSupernode ? ' • Supernode Host' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-white/50">Audio Quality:</span>
                <span className="text-emerald-400 font-semibold">
                  Opus 510kbps Stereo (Hi-Fi)
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-white/50">Encryption:</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> End-to-End Encrypted
                </span>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <div className="truncate text-white/60 text-[11px] bg-black/40 px-2 py-1.5 rounded-lg border border-white/5 flex-1 font-mono">
                  {getInviteLink()}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-[#0E72ED] hover:bg-[#005CE6] text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. CENTER: Meeting Clock Duration */}
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 border border-white/10 text-xs font-mono text-white/80 backdrop-blur-md">
        <Clock className="w-3.5 h-3.5 text-white/50" />
        <span>{formatTimer(secondsElapsed)}</span>
      </div>

      {/* 3. RIGHT: Authentic Zoom "View ⊞" Dropdown + Mobile Leave Button + Fullscreen */}
      <div className="flex items-center gap-2 relative">
        {/* Mobile Red Leave/End Button (Zoom Mobile layout) */}
        {onLeave && (
          <button
            onClick={onLeave}
            className="md:hidden px-3 py-1 rounded-md bg-[#E02828] hover:bg-[#C91A1A] text-white font-bold text-xs shadow-md transition"
          >
            {isHost ? 'End' : 'Leave'}
          </button>
        )}

        <div className="relative">
          <button
            id="zoom-view-btn"
            onClick={() => setShowViewDropdown(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-black/40 hover:bg-black/60 border border-white/10 text-white text-xs font-semibold transition"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-white/70" />
            <span>View</span>
            <ChevronDown className="w-3 h-3 text-white/50" />
          </button>

          {showViewDropdown && (
            <div
              ref={viewMenuRef}
              className="absolute right-0 top-9 w-48 rounded-xl bg-[#232326] border border-white/15 p-1.5 text-xs shadow-2xl text-white z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={() => { onToggleViewMode?.('speaker'); setShowViewDropdown(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition ${
                  viewMode === 'speaker' ? 'bg-[#0E72ED] text-white font-semibold' : 'hover:bg-white/10 text-white/80'
                }`}
              >
                <span>Speaker View</span>
                {viewMode === 'speaker' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => { onToggleViewMode?.('gallery'); setShowViewDropdown(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition ${
                  viewMode === 'gallery' ? 'bg-[#0E72ED] text-white font-semibold' : 'hover:bg-white/10 text-white/80'
                }`}
              >
                <span>Gallery View</span>
                {viewMode === 'gallery' && <Check className="w-3.5 h-3.5" />}
              </button>

              <div className="h-[1px] bg-white/10 my-1" />

              {onToggleWhiteboard && (
                <button
                  onClick={() => { onToggleWhiteboard(); setShowViewDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/10 text-white/80 flex items-center justify-between transition"
                >
                  <span>Whiteboard</span>
                  <span>🖊️</span>
                </button>
              )}

              <button
                onClick={() => { toggleFullscreen(); setShowViewDropdown(false); }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/10 text-white/80 flex items-center justify-between transition"
              >
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
