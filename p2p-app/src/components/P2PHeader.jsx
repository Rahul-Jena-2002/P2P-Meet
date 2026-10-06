'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect } from 'react';
import { ShieldCheck, LayoutGrid, Maximize2, Minimize2, Copy, Check, Clock } from 'lucide-react';
import P2PLogo from './P2PLogo';

export default function P2PHeader({
  title,
  roomCode,
  viewMode,
  onToggleViewMode,
  isPanelOpen = false,
  isVisible = true,
  isMobile = false,
  isMobileLandscape = false
}) {
  const [copied, setCopied] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(`${window.location.origin}?code=${roomCode}`);
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
    <header className={`absolute ${isMobileLandscape ? 'top-1.5 left-2 right-2' : 'top-2 sm:top-4 left-2 sm:left-6 right-2 sm:right-6'} transition-all duration-300 ease-out z-30 flex items-center justify-between pointer-events-none select-none gap-2 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
    }`}>
      {/* Left: Topic & Code */}
      <div className="flex items-center gap-2 pointer-events-auto min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl p2p-dock max-w-full">
          <P2PLogo size={20} className="shrink-0" />
          <div className="hidden md:flex items-center gap-1 text-[#DAA520] text-xs font-semibold shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>P2P</span>
          </div>
          <div className="hidden md:block w-[1px] h-3.5 bg-[#F5E8D8]/10" />
          <h2 className="text-xs sm:text-sm font-bold text-[#F5E8D8] tracking-tight truncate max-w-[85px] sm:max-w-[160px]">
            {title || 'p2pmeet'}
          </h2>
          <div className="w-[1px] h-3.5 bg-[#F5E8D8]/10 shrink-0" />
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-[#F5E8D8]/5 hover:bg-[#F5E8D8]/10 border border-[#F5E8D8]/10 text-[#F5E8D8] hover:border-[#FF6F61]/40 transition text-[11px] sm:text-xs font-mono font-semibold shrink-0"
            title="Click to copy invite link"
          >
            <span>{roomCode}</span>
            {copied ? <Check className="w-3 h-3 text-[#DAA520]" /> : <Copy className="w-3 h-3 text-[#F5E8D8]/50" />}
          </button>
        </div>
      </div>

      {/* Center: Meeting Duration Clock */}
      <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl p2p-dock pointer-events-auto text-xs font-mono font-medium text-[#F5E8D8]/80">
        <Clock className="w-3.5 h-3.5 text-[#DAA520]" />
        <span>{formatTimer(secondsElapsed)}</span>
      </div>

      {/* Right: Layout Switcher & Fullscreen */}
      <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto shrink-0">
        <button
          onClick={onToggleViewMode}
          className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-2xl p2p-dock text-[#F5E8D8] hover:text-white transition text-xs font-semibold border border-[#F5E8D8]/10"
          title="Switch Gallery / Speaker View"
        >
          <LayoutGrid className="w-4 h-4 text-[#FF6F61]" />
          <span className="hidden sm:inline">{viewMode === 'gallery' ? 'Speaker View' : 'Gallery View'}</span>
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl p2p-dock text-[#F5E8D8] hover:text-[#FF6F61] transition border border-[#F5E8D8]/10"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
