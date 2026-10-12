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
  Check, Clock, Users, ChevronDown, Circle, X, Monitor, Shield, Info
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
  onToggleRecording,
  onRequestRecording,
  recordingRequestPending = false,
  recordingRequests = [],
  onResolveRecordingRequest,
  onStopRecording,
  onToggleWhiteboard,
  isMobile = false,
  isMobileLandscape = false,
  presentationInfo = null,
  sidebarOffset = 0,
  securitySettings = { lockMeeting: false, allowScreenShare: true, allowChat: true, allowRename: true, allowUnmute: true },
  onUpdateSecurity
}) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showSecurityMenu, setShowSecurityMenu] = useState(false);
  const [showRecordingRequests, setShowRecordingRequests] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef(null);
  const viewMenuRef = useRef(null);
  const securityMenuRef = useRef(null);

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
      if (securityMenuRef.current && !securityMenuRef.current.contains(e.target)) setShowSecurityMenu(false);
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
    <header
      style={{
        right: sidebarOffset ? `${sidebarOffset + 24}px` : undefined
      }}
      className={`meeting-header-row fixed sm:absolute top-1.5 sm:top-2 left-3 sm:left-5 right-3 sm:right-5 z-30 flex items-center justify-between gap-3 px-1 py-0 select-none transition-all duration-300 ease-in-out ${
        'translate-y-0 opacity-100'
      }`}
    >
      {/* 1. LEFT: Iconic Security Shield (Meeting Info) + Viewing Message + Recording Badge */}
      <div className="flex items-center gap-2 relative min-w-0 flex-1">
        <button
          id="zoom-info-btn"
          onClick={() => setShowInfoModal(v => !v)}
          className={`pointer-events-auto flex items-center gap-2 px-1 py-1 transition text-sm font-semibold cursor-pointer ${
            showInfoModal ? 'text-[#FFA14A]' : 'text-white hover:text-[#FFA14A]'
          }`}
          title="Meeting information"
        >
          <Info className="w-4 h-4 text-[#FF6B35]" />
          <span className="hidden sm:inline font-semibold text-[#F8F7FC]">{title}</span>
        </button>

        {isHost && (
          <div ref={securityMenuRef} className="relative pointer-events-auto shrink-0">
            <button
              type="button"
              aria-label="Meeting security settings"
              aria-expanded={showSecurityMenu}
              onClick={() => setShowSecurityMenu(value => !value)}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${showSecurityMenu ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/[0.08] hover:text-white'}`}
              title="Security and participant permissions"
            >
              <Shield className="h-4 w-4 text-[#FF6B35]" />
            </button>
            {showSecurityMenu && (
              <div className="absolute left-0 top-10 z-50 w-64 rounded-2xl border border-white/15 bg-[#161324]/85 p-2.5 text-xs text-[#F8F7FC] shadow-2xl backdrop-blur-2xl">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Meeting security</div>
                {[
                  ['lockMeeting', 'Lock Meeting'],
                  ['allowScreenShare', 'Share Screen'],
                  ['allowChat', 'Chat'],
                  ['allowRename', 'Rename Themselves'],
                  ['allowUnmute', 'Unmute Themselves']
                ].map(([key, label]) => {
                  const enabled = Boolean(securitySettings[key]);
                  return (
                    <button
                      key={key}
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => onUpdateSecurity?.({ [key]: !enabled })}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition hover:bg-white/10"
                    >
                      <span>{label}</span>
                      {enabled ? <Check className="h-3.5 w-3.5 text-[#FF6B35]" /> : <span className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Viewing message replaces Direct Mesh */}
        {presentationInfo && (
          <div className="pointer-events-auto flex items-center gap-2 px-1 py-1 text-xs font-medium text-white/75 min-w-0">
            <Monitor className="w-4 h-4 text-[#FFA14A]" />
            <span className="font-medium truncate max-w-[180px] sm:max-w-none">
              {presentationInfo.label || `Viewing ${presentationInfo.name}`}
            </span>
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-red-200 text-[10px] sm:text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>REC</span>
          </div>
        )}

        {/* Meeting Info Popup */}
        {showInfoModal && (
          <div
            ref={modalRef}
            className="meeting-info-glass absolute top-10 left-0 w-80 sm:w-96 rounded-2xl p-4 text-xs text-[#F8F7FC] z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
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

            <div className="space-y-2 font-sans">
              <div className="flex items-center justify-between py-1">
                <span className="text-[#C4B5FD]/70">Meeting code</span>
                <span className="font-mono font-bold tracking-wider text-[#FF6B35] text-[13px]">{roomCode}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[#C4B5FD]/70">Host:</span>
                <span className="font-medium text-[#F8F7FC]">{hostName}</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex items-center justify-end">
                <button
                  onClick={handleCopyLink}
                  className="liquid-glass-button px-3 py-1.5 rounded-xl text-white font-semibold text-xs shrink-0 flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Invite link copied' : 'Copy invite link'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. CENTER: Meeting Clock Duration with Orange Live Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-white/75 pointer-events-auto">
        <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-pulse" />
        <Clock className="w-3.5 h-3.5 text-[#FFA14A]" />
        <span className="font-bold">{formatTimer(secondsElapsed)}</span>
      </div>

      {/* 3. RIGHT: "View ⊞" Dropdown + Mobile Leave Button + Fullscreen */}
      <div className="flex items-center gap-2 relative shrink-0">
        {!isRecording && (isHost || onRequestRecording) && (
          <div className="relative pointer-events-auto">
            <button
              type="button"
              onClick={isHost ? onToggleRecording : onRequestRecording}
              disabled={!isHost && recordingRequestPending}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] sm:text-xs font-semibold transition ${
                recordingRequestPending
                  ? 'border-white/10 text-white/45 cursor-default'
                  : 'border-red-400/25 text-white/85 hover:border-red-400/50 hover:bg-red-500/10'
              }`}
              title={isHost ? 'Start meeting recording' : 'Ask the host to start recording'}
            >
              <Circle className="h-3 w-3 fill-red-500 text-red-500" />
              <span>{isHost ? 'Record' : recordingRequestPending ? 'Requested' : 'Request'}</span>
            </button>
          </div>
        )}
        {isRecording && isHost && onStopRecording && (
          <button type="button" onClick={onStopRecording} className="rounded-lg border border-red-400/35 bg-red-500/15 px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-red-100 hover:bg-red-500/25">Stop</button>
        )}
        {isHost && recordingRequests.length > 0 && (
          <div className="relative pointer-events-auto">
            <button type="button" onClick={() => setShowRecordingRequests(value => !value)} className="rounded-lg border border-red-400/25 px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
              Requests <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[9px] text-white">{recordingRequests.length}</span>
            </button>
            {showRecordingRequests && (
              <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-white/15 bg-[#161324]/90 p-2 text-xs text-white shadow-2xl backdrop-blur-xl">
                <div className="px-2 py-1.5 font-semibold text-white/75">Recording requests</div>
                {recordingRequests.map(request => (
                  <div key={request.requesterId} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.05]">
                    <span className="min-w-0 truncate">{request.requesterName} wants the host to record</span>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => { onResolveRecordingRequest?.(request, true); setShowRecordingRequests(false); }} className="rounded-md bg-red-500/90 px-2 py-1 text-white hover:bg-red-500">Start</button>
                      <button type="button" onClick={() => { onResolveRecordingRequest?.(request, false); setShowRecordingRequests(false); }} className="rounded-md px-2 py-1 text-white/65 hover:bg-white/10">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mobile Leave/End Button */}
        {onLeave && (
          <button
            onClick={onLeave}
            className="meeting-mobile-leave md:hidden pointer-events-auto px-3.5 py-1.5 rounded-full bg-[#FF6B35] hover:bg-[#FF854D] text-[#0D0B14] font-bold text-xs border border-[#FF6B35] transition cursor-pointer"
          >
            {isHost ? 'End' : 'Leave'}
          </button>
        )}

        <div className="relative pointer-events-auto">
          <button
            id="zoom-view-btn"
            onClick={() => setShowViewDropdown(v => !v)}
            className="meeting-control-button flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-semibold backdrop-blur-2xl transition cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#FFA14A]" />
            <span className="sr-only">View</span>
            <ChevronDown className="w-3 h-3 text-white/80" />
          </button>

          {showViewDropdown && (
            <div
              ref={viewMenuRef}
              className="absolute right-0 top-12 w-48 rounded-2xl bg-[#161324]/85 border border-white/20 p-1.5 text-xs text-[#F8F7FC] z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={() => { onToggleViewMode?.('speaker'); setShowViewDropdown(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition ${
                  viewMode === 'speaker'
                    ? 'bg-[#FF6B35] text-[#0D0B14] font-bold'
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
                    ? 'bg-[#FF6B35] text-[#0D0B14] font-bold'
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
