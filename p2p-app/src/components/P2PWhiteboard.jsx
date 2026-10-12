'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Official Excalidraw Collaborative Whiteboard Integration
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { X, Maximize2, Minimize2, Edit3 } from 'lucide-react';
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

export default function P2PWhiteboard({ onClose, onBroadcastStroke, incomingStroke, isEmbedded = false, isClosing = false }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isRemoteUpdateRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const containerRef = useRef(null);

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
      className={`meeting-whiteboard ${isEmbedded ? 'meeting-whiteboard-embedded' : 'fixed inset-0 z-50'} ${isClosing ? 'is-closing' : ''} flex flex-col bg-[#0D0B14] text-[#F8F7FC] pointer-events-auto`}
    >
      {/* Top Header Bar */}
      <header className="h-10 bg-[#161324]/65 backdrop-blur-2xl border-b border-white/10 px-3 sm:px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#FF6B35]/20 border border-[#FF6B35]/40 flex items-center justify-center text-[#FF6B35]">
            <Edit3 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-xs tracking-wide text-[#F8F7FC]">Whiteboard</h3>
            {!isEmbedded && <span className="text-[10px] text-[#C4B5FD]/60 block leading-tight">Shared whiteboard</span>}
          </div>
          {!isEmbedded && <span className="ml-2 text-[10px] font-medium text-white/50">Live with everyone</span>}
        </div>

        <div className="flex items-center gap-1.5">
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
      <div className="min-h-0 flex-1 w-full relative overflow-hidden pointer-events-auto">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={handleChange}
          initialData={{
            appState: {
              theme: 'dark',
              // Excalidraw's dark theme inverts this color through its theme filter.
              viewBackgroundColor: '#ffffff',
              currentItemFontFamily: 1,
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
