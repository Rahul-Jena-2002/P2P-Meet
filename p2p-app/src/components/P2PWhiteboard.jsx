'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Official Excalidraw Collaborative Whiteboard Integration
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { X, Sparkles, Maximize2, Minimize2, Edit3 } from 'lucide-react';
import '@excalidraw/excalidraw/index.css';

// Dynamically import Excalidraw to ensure no SSR errors in Next.js
const Excalidraw = dynamic(
  async () => {
    const mod = await import('@excalidraw/excalidraw');
    return mod.Excalidraw;
  },
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0D0B14] text-[#F8F7FC]">
        <div className="w-9 h-9 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-medium text-[#C4B5FD]/80 tracking-wide">Loading Excalidraw Canvas...</span>
      </div>
    )
  }
);

export default function P2PWhiteboard({ onClose, onBroadcastStroke, incomingStroke }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isRemoteUpdateRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const containerRef = useRef(null);

  // Set default tool to freedraw (pen) once API is ready
  useEffect(() => {
    if (excalidrawAPI) {
      try {
        excalidrawAPI.setActiveTool({ type: 'freedraw' });
      } catch (_) {}
    }
  }, [excalidrawAPI]);

  // Sync incoming elements from remote peers
  useEffect(() => {
    if (!excalidrawAPI || !incomingStroke) return;

    if (incomingStroke.type === 'EXCALIDRAW_SYNC' && Array.isArray(incomingStroke.elements)) {
      isRemoteUpdateRef.current = true;
      try {
        excalidrawAPI.updateScene({
          elements: incomingStroke.elements,
          commitToHistory: false
        });
      } catch (err) {
        console.warn('[Excalidraw] Failed to update scene with incoming elements:', err);
      } finally {
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 80);
      }
    }
  }, [excalidrawAPI, incomingStroke]);

  // Handle local scene change and broadcast to room
  const handleChange = useCallback((elements, appState, files) => {
    if (isRemoteUpdateRef.current) return;
    if (!onBroadcastStroke) return;

    // Debounce broadcast by 80ms to prevent flooding P2P data channel while dragging
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      try {
        onBroadcastStroke({
          type: 'EXCALIDRAW_SYNC',
          elements
        });
      } catch (err) {
        console.warn('[Excalidraw] Broadcast error:', err);
      }
    }, 80);
  }, [onBroadcastStroke]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#0D0B14] text-[#F8F7FC] animate-in fade-in duration-150 pointer-events-auto"
    >
      {/* Top Header Bar */}
      <header className="h-12 bg-[#161324] border-b border-[#C4B5FD]/15 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#FF6B35]/20 border border-[#FF6B35]/40 flex items-center justify-center text-[#FF6B35]">
            <Edit3 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-xs tracking-wide text-[#F8F7FC]">Excalidraw Whiteboard</h3>
            <span className="text-[10px] text-[#C4B5FD]/60 block leading-tight">Virtual hand-drawn diagramming</span>
          </div>
          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#C4B5FD]/15 text-[#C4B5FD] border border-[#C4B5FD]/30">
            P2P Synced
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (excalidrawAPI) {
                excalidrawAPI.setActiveTool({ type: 'freedraw' });
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FFA14A] text-xs font-semibold flex items-center gap-1.5 transition"
            title="Switch to Draw Pen"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Draw</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#F8F7FC]/70 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FFA14A] hover:text-white transition"
            title="Close Whiteboard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Excalidraw Canvas Area */}
      <div className="flex-1 w-full h-[calc(100%-48px)] relative overflow-hidden pointer-events-auto">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={handleChange}
          initialData={{
            appState: {
              theme: 'dark',
              viewBackgroundColor: '#0D0B14',
              currentItemFontFamily: 1,
              activeTool: { type: 'freedraw' },
              currentItemStrokeColor: '#C4B5FD',
              currentItemRoughness: 1
            }
          }}
          theme="dark"
          viewModeEnabled={false}
          zenModeEnabled={false}
          UIOptions={{
            canvasActions: {
              loadScene: false
            }
          }}
        />
      </div>
    </div>
  );
}
