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
    <header className={`fixed sm:absolute top-3 sm:top-5 left-3 sm:left-6 right-3 sm:right-6 z-30 flex items-center justify-between select-none pointer-events-none transition-all duration-300 ${
      isVisible ? 'opacity-100' : 'opacity-0'
    }`}>
      {/* 1. LEFT: Iconic Security Shield (Meeting Info) + Recording Badge */}
      <div className="flex items-center gap-2 relative">
        <button
          id="zoom-info-btn"
          onClick={() => setShowInfoModal(v => !v)}
          className={`pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition text-xs font-semibold border border-[#FF6B35]/70 backdrop-blur-xl cursor-pointer ${
            showInfoModal
              ? 'bg-[#FF6B35] text-[#0D0B14]'
              : 'bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 text-[#F8F7FC]'
          }`}
          title="Meeting Information (E2EE Direct Security)"
        >
          <ShieldCheck className="w-4 h-4 text-[#FF6B35]" />
          <span className="hidden sm:inline font-semibold text-[#F8F7FC]">{title}</span>
        </button>

        {/* Network Topology Badge */}
        <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-[#FF6B35]/70 bg-[#0D0B14]/50 backdrop-blur-xl pointer-events-auto ${
          topologyMode === 'relay-tree' ? 'text-[#C4B5FD]' : 'text-[#FFA14A]'
        }`} title={topologyMode === 'relay-tree' ? 'Decentralized Relay SFU tree' : 'Zero latency Full Mesh connection'}>
          <span className={`w-1.5 h-1.5 rounded-full ${topologyMode === 'relay-tree' ? 'bg-[#C4B5FD]' : 'bg-[#FF6B35]'} animate-pulse`} />
          <span>{topologyMode === 'relay-tree' ? (isSupernode ? 'Supernode Host' : 'Relay Tree') : 'Direct Mesh'}</span>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FF6B35]/80 backdrop-blur-xl border border-[#FF6B35] text-[#0D0B14] text-xs font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#0D0B14] animate-ping" />
            <span>● Recording</span>
            {onStopRecording && (
              <button
                onClick={onStopRecording}
                className="ml-1 px-1.5 py-0.5 rounded-full bg-[#0D0B14]/30 hover:bg-[#0D0B14]/60 text-[10px] text-[#0D0B14] font-bold"
                title="Stop Recording"
              >
                Stop
              </button>
            )}
          </div>
        )}

        {/* Meeting Info Popup */}
        {showInfoModal && (
          <div
            ref={modalRef}
            className="absolute top-12 left-0 w-80 sm:w-96 rounded-2xl bg-[#161324]/90 border border-[#FF6B35]/70 p-4 text-xs shadow-2xl shadow-black/90 text-[#F8F7FC] z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(196,181,253,0.14)] mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[rgba(196,181,253,0.14)] border border-[rgba(196,181,253,0.25)] flex items-center justify-center text-[#C4B5FD]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-[#F8F7FC]">{title || 'p2pmeet Call'}</h4>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg hover:bg-[rgba(196,181,253,0.10)] text-[#C4B5FD]/70 hover:text-[#F8F7FC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 font-sans">
              <div className="flex items-center justify-between py-1">
                <span className="text-[#C4B5FD]/70">Meeting ID:</span>
                <span className="font-mono font-bold tracking-wider text-[#FF6B35] text-[13px]">{roomCode}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[#C4B5FD]/70">Host:</span>
                <span className="font-medium text-[#F8F7FC]">{hostName}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[#C4B5FD]/70">Passcode:</span>
                <span className="font-mono bg-[#0D0B14] border border-[rgba(196,181,253,0.18)] px-2 py-0.5 rounded-md text-[#C4B5FD] font-semibold">2026</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[#C4B5FD]/70">Topology:</span>
                <span className="font-semibold text-[#F8F7FC]">
                  {topologyMode === 'relay-tree' ? 'Decentralized Relay SFU' : 'Direct Full Mesh (P2P)'}
                  {isSupernode ? ' • Supernode Host' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[#C4B5FD]/70">Audio Quality:</span>
                <span className="text-[#FFA14A] font-semibold">
                  Opus 510kbps Stereo (Hi-Fi)
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[#C4B5FD]/70">Encryption:</span>
                <span className="text-[#C4B5FD] font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#FF6B35]" /> End-to-End Encrypted (SFrame + E2EE)
                </span>
              </div>

              <div className="pt-2 border-t border-[rgba(196,181,253,0.14)] flex items-center justify-between gap-2">
                <div className="truncate text-[#C4B5FD]/70 text-[11px] bg-[#0D0B14] px-2.5 py-1.5 rounded-xl border border-[rgba(196,181,253,0.14)] flex-1 font-mono">
                  {getInviteLink()}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] hover:brightness-110 text-[#0D0B14] font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-md shadow-[#FF6B35]/20 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. CENTER: Meeting Clock Duration with Orange Live Indicator */}
      <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0D0B14]/50 border border-[#FF6B35]/70 text-xs font-mono text-[#F8F7FC] backdrop-blur-xl pointer-events-auto">
        <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-pulse" />
        <Clock className="w-3.5 h-3.5 text-[#FFA14A]" />
        <span className="font-bold">{formatTimer(secondsElapsed)}</span>
      </div>

      {/* 3. RIGHT: "View ⊞" Dropdown + Mobile Leave Button + Fullscreen */}
      <div className="flex items-center gap-2 relative">
        {/* Mobile Leave/End Button */}
        {onLeave && (
          <button
            onClick={onLeave}
            className="md:hidden pointer-events-auto px-3.5 py-1.5 rounded-full bg-[#FF6B35] hover:bg-[#FF854D] text-[#0D0B14] font-bold text-xs border border-[#FF6B35] transition cursor-pointer"
          >
            {isHost ? 'End' : 'Leave'}
          </button>
        )}

        <div className="relative pointer-events-auto">
          <button
            id="zoom-view-btn"
            onClick={() => setShowViewDropdown(v => !v)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 border border-[#FF6B35]/70 text-[#F8F7FC] text-xs font-semibold backdrop-blur-xl transition cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#FF6B35]" />
            <span>View</span>
            <ChevronDown className="w-3 h-3 text-[#FF6B35]" />
          </button>

          {showViewDropdown && (
            <div
              ref={viewMenuRef}
              className="absolute right-0 top-12 w-48 rounded-2xl bg-[#161324]/90 border border-[#FF6B35]/70 p-1.5 text-xs shadow-2xl shadow-black/90 text-[#F8F7FC] z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={() => { onToggleViewMode?.('speaker'); setShowViewDropdown(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition ${
                  viewMode === 'speaker'
                    ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold'
                    : 'hover:bg-[rgba(196,181,253,0.12)] text-[#F8F7FC]/80'
                }`}
              >
                <span>Speaker View</span>
                {viewMode === 'speaker' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => { onToggleViewMode?.('gallery'); setShowViewDropdown(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition ${
                  viewMode === 'gallery'
                    ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold'
                    : 'hover:bg-[rgba(196,181,253,0.12)] text-[#F8F7FC]/80'
                }`}
              >
                <span>Gallery View</span>
                {viewMode === 'gallery' && <Check className="w-3.5 h-3.5" />}
              </button>

              <div className="h-[1px] bg-[rgba(196,181,253,0.14)] my-1" />

              {onToggleWhiteboard && (
                <button
                  onClick={() => { onToggleWhiteboard(); setShowViewDropdown(false); }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[rgba(196,181,253,0.12)] text-[#F8F7FC]/80 flex items-center justify-between transition"
                >
                  <span>Whiteboard</span>
                  <span>🖊️</span>
                </button>
              )}

              <button
                onClick={() => { toggleFullscreen(); setShowViewDropdown(false); }}
                className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[rgba(196,181,253,0.12)] text-[#F8F7FC]/80 flex items-center justify-between transition"
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
