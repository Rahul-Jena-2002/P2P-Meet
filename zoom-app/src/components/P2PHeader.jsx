'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect } from 'react';
import { ShieldCheck, LayoutGrid, Maximize2, Minimize2, Copy, Check, Clock } from 'lucide-react';

export default function P2PHeader({
  title,
  roomCode,
  viewMode,
  onToggleViewMode,
  isVisible = true
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
    <header className={`fixed top-4 left-6 right-6 z-40 flex items-center justify-between pointer-events-none select-none transition-all duration-300 ease-out ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
    }`}>
      {/* Left: Topic & Code */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl p2p-dock">
          <div className="flex items-center gap-1.5 text-[#DAA520] text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">P2P Encrypted</span>
          </div>
          <div className="w-[1px] h-4 bg-[#F5E8D8]/10" />
          <h2 className="text-sm font-bold text-[#F5E8D8] tracking-tight">{title || 'p2pmeet Session'}</h2>
          <div className="w-[1px] h-4 bg-[#F5E8D8]/10" />
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#F5E8D8]/5 hover:bg-[#F5E8D8]/10 border border-[#F5E8D8]/10 text-[#F5E8D8] hover:border-[#FF6F61]/40 transition text-xs font-mono font-semibold"
            title="Click to copy invite link"
          >
            <span>{roomCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-[#DAA520]" /> : <Copy className="w-3.5 h-3.5 text-[#F5E8D8]/50" />}
          </button>
        </div>
      </div>

      {/* Center: Meeting Duration Clock */}
      <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl p2p-dock pointer-events-auto text-xs font-mono font-medium text-[#F5E8D8]/80">
        <Clock className="w-3.5 h-3.5 text-[#DAA520]" />
        <span>{formatTimer(secondsElapsed)}</span>
      </div>

      {/* Right: Layout Switcher & Fullscreen */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onToggleViewMode}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl p2p-dock text-[#F5E8D8] hover:text-white transition text-xs font-semibold border border-[#F5E8D8]/10"
          title="Switch Gallery / Speaker View"
        >
          <LayoutGrid className="w-4 h-4 text-[#FF6F61]" />
          <span className="hidden sm:inline">{viewMode === 'gallery' ? 'Speaker View' : 'Gallery View'}</span>
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-2.5 rounded-2xl p2p-dock text-[#F5E8D8] hover:text-[#FF6F61] transition border border-[#F5E8D8]/10"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
