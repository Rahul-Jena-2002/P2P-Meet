'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect } from 'react';
import { ShieldCheck, LayoutGrid, Maximize2, Minimize2, Copy, Check, Clock } from 'lucide-react';

export default function ZoomHeader({
  title,
  roomCode,
  viewMode,
  onToggleViewMode
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
    <header className="fixed top-4 left-6 right-6 z-40 flex items-center justify-between pointer-events-none select-none">
      {/* Left: Topic & Code */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl zoom-dock">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">P2P Mesh</span>
          </div>
          <div className="w-[1px] h-4 bg-white/10" />
          <h2 className="text-sm font-bold text-white tracking-wide">{title || 'Zoom Meeting'}</h2>
          <div className="w-[1px] h-4 bg-white/10" />
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition text-xs font-mono font-semibold"
            title="Click to copy invite link"
          >
            <span>{roomCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Center: Meeting Duration Clock */}
      <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl zoom-dock pointer-events-auto text-xs font-mono font-medium text-slate-300">
        <Clock className="w-3.5 h-3.5 text-blue-400" />
        <span>{formatTimer(secondsElapsed)}</span>
      </div>

      {/* Right: Layout Switcher & Fullscreen */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onToggleViewMode}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl zoom-dock text-slate-200 hover:text-white transition text-xs font-semibold"
          title="Switch Gallery / Speaker View"
        >
          <LayoutGrid className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">{viewMode === 'gallery' ? 'Speaker View' : 'Gallery View'}</span>
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-2.5 rounded-2xl zoom-dock text-slate-200 hover:text-white transition"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
