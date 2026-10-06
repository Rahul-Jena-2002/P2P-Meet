'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
import { MousePointer, ShieldAlert, Monitor, Check, X, Play, Pause, Clapperboard } from 'lucide-react';
import ZoomVideoTile from './ZoomVideoTile';

export default function ZoomGrid({
  localUser,
  localStream,
  screenStream,
  peers,
  isAudioOn,
  isVideoOn,
  isScreenSharing,
  viewMode, // 'gallery' | 'speaker'
  speakingUserId,
  remoteControlState, // { isControlling, isBeingControlled, controllerName, requestPending, requesterName }
  onRequestRemoteControl,
  onGrantRemoteControl,
  onGrantRemoteControlToPeer,
  onSimulateRemoteControl,
  onRevokeRemoteControl,
  onSendRemoteMouseEvent,
  remoteCursor, // { x, y, name }
  remoteRipples,
  watchTogetherState, // { active, url, isPlaying, currentTime }
  onWatchTogetherSync,
  onStopWatchTogether
}) {
  const [pinnedId, setPinnedId] = useState(null);
  const [showGrantMenu, setShowGrantMenu] = useState(false);

  const peerList = Object.values(peers);
  const totalCount = 1 + peerList.length;

  // Active or pinned item for presentation mode
  const isSomeoneSharing = isScreenSharing || peerList.some(p => p.isScreenSharing);
  
  // Who is sharing?
  const sharingPeer = isScreenSharing
    ? {
        id: localUser.id,
        name: `${localUser.name} (Screen)`,
        stream: screenStream,
        isLocal: true,
        isHost: localUser.isHost,
        isAudioOn: true,
        isVideoOn: true, // Screen share video is ALWAYS active!
        isScreenSharing: true
      }
    : peerList.find(p => p.isScreenSharing);

  const heroTile = sharingPeer || (pinnedId
    ? (pinnedId === localUser.id
        ? { id: localUser.id, name: localUser.name, stream: localStream, isLocal: true, isHost: localUser.isHost, isAudioOn, isVideoOn, isScreenSharing: false }
        : peers[pinnedId])
    : (viewMode === 'speaker' && peerList.length > 0 ? peerList[0] : null));

  // Handle Remote Mouse Interaction on Screen Share (RemoteDesk + Zoom style)
  const handleMouseMove = (e) => {
    if (!remoteControlState?.isControlling) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    onSendRemoteMouseEvent?.({ type: 'move', x, y });
  };

  const handleClick = (e) => {
    if (!remoteControlState?.isControlling) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    onSendRemoteMouseEvent?.({ type: 'click', click: true, x, y });
  };

  // 1. ZOOM SIDE-BY-SIDE PRESENTATION MODE (Screen Sharing / Watch Together / Pinned Hero)
  if (heroTile || watchTogetherState?.active) {
    return (
      <div className="absolute inset-0 w-full h-full p-4 pt-16 pb-24 flex flex-row gap-4">
        {/* LEFT / CENTER: Huge Main Presentation Stage (75% to 80% width) */}
        <div className="flex-1 h-full min-w-0 flex flex-col relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
          {/* Top Bar for Remote Access Controls */}
          {heroTile && (
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-xs font-semibold text-white pointer-events-auto shadow-lg">
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span>Viewing: {heroTile.name}</span>
                {heroTile.isLocal && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                    You are sharing
                  </span>
                )}
              </div>

              {/* Remote Desktop Access Controls (RemoteDesk + Zoom) */}
              <div className="pointer-events-auto flex items-center gap-2">
                {/* 1. Host: Someone requested remote desktop control */}
                {isScreenSharing && remoteControlState?.requestPending && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-bold shadow-2xl animate-bounce">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{remoteControlState.requesterName} requests Remote Access</span>
                    <button
                      onClick={() => onGrantRemoteControl?.(true)}
                      className="px-2.5 py-1 rounded-lg bg-black text-white hover:bg-neutral-800 transition"
                    >
                      Allow
                    </button>
                    <button
                      onClick={() => onGrantRemoteControl?.(false)}
                      className="px-2.5 py-1 rounded-lg bg-neutral-200 text-black hover:bg-white transition"
                    >
                      Deny
                    </button>
                  </div>
                )}

                {/* 2. Host: Someone is actively controlling */}
                {isScreenSharing && remoteControlState?.isBeingControlled && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-lg border border-blue-400/30">
                    <MousePointer className="w-3.5 h-3.5 animate-pulse" />
                    <span>Controlled by {remoteControlState.controllerName}</span>
                    <button
                      onClick={onRevokeRemoteControl}
                      className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white transition text-xs shadow"
                    >
                      Revoke Control
                    </button>
                  </div>
                )}

                {/* 3. Host: Ready for remote access */}
                {isScreenSharing && !remoteControlState?.isBeingControlled && !remoteControlState?.requestPending && (
                  <div className="relative flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/90 border border-white/10 text-white text-xs font-medium backdrop-blur-md">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Remote Access Ready</span>
                    </div>

                    {peerList.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowGrantMenu(!showGrantMenu)}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition"
                        >
                          Give Control ▾
                        </button>
                        {showGrantMenu && (
                          <div className="absolute right-0 top-10 w-48 rounded-xl bg-neutral-900/95 border border-white/10 p-2 text-xs shadow-2xl z-50">
                            <span className="text-[10px] font-bold text-slate-400 block px-2 mb-1 uppercase">Select User</span>
                            {peerList.map(p => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  onGrantRemoteControlToPeer?.(p.id, p.name);
                                  setShowGrantMenu(false);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/10 text-white transition"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={onSimulateRemoteControl}
                      title="Test simulated remote cursor and click ripples"
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-slate-200 text-xs font-medium border border-white/10 transition"
                    >
                      Test Remote Cursor
                    </button>
                  </div>
                )}

                {/* 4. Viewer on shared screen: Can request or release control */}
                {!isScreenSharing && heroTile.id !== localUser.id && (
                  <div>
                    {remoteControlState?.isControlling ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg border border-emerald-400/40">
                        <MousePointer className="w-3.5 h-3.5 animate-bounce" />
                        <span>Remote Control Active (Click & Move on Screen)</span>
                        <button
                          onClick={onRevokeRemoteControl}
                          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white transition text-xs shadow"
                        >
                          Release Control
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={onRequestRemoteControl}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold backdrop-blur-md shadow-lg transition"
                      >
                        <MousePointer className="w-3.5 h-3.5" />
                        <span>Request Remote Control</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Watch-Together Co-Streaming Player Stage */}
          {watchTogetherState?.active ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
              <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-xs font-semibold text-white pointer-events-auto shadow-lg">
                  <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Watch Party (Synchronized Co-Streaming)</span>
                </div>
                <button
                  onClick={onStopWatchTogether}
                  className="pointer-events-auto px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold shadow transition"
                >
                  End Watch Party
                </button>
              </div>

              <video
                src={watchTogetherState.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
                onPlay={() => onWatchTogetherSync?.({ action: 'play' })}
                onPause={() => onWatchTogetherSync?.({ action: 'pause' })}
                onSeeked={(e) => onWatchTogetherSync?.({ action: 'seek', time: e.target.currentTime })}
              />
            </div>
          ) : (
            /* Main Shared Screen Presentation Tile */
            <div
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              className={`w-full h-full relative ${remoteControlState?.isControlling ? 'cursor-crosshair' : ''}`}
            >
              <ZoomVideoTile
                name={heroTile.name}
                stream={heroTile.stream}
                isLocal={heroTile.isLocal}
                isHost={heroTile.isHost}
                isAudioOn={heroTile.isAudioOn}
                isVideoOn={true}
                isScreenSharing={true}
                isSpeaking={speakingUserId === heroTile.id}
                isPinned={true}
                onPinToggle={() => setPinnedId(null)}
              />

              {/* Click Ripple Animations for Remote Desktop */}
              {remoteRipples?.map(r => (
                <div
                  key={r.id}
                  className="absolute pointer-events-none rounded-full border-2 border-amber-400 bg-amber-400/30 animate-ping -translate-x-1/2 -translate-y-1/2 z-40"
                  style={{ top: `${r.y}%`, left: `${r.x}%`, width: '40px', height: '40px' }}
                />
              ))}

              {/* Virtual Remote Cursor Overlay */}
              {remoteCursor && (
                <div
                  className="absolute z-40 pointer-events-none transition-all duration-75 flex items-center gap-1 -translate-x-1 -translate-y-1"
                  style={{ top: `${remoteCursor.y}%`, left: `${remoteCursor.x}%` }}
                >
                  <MousePointer className="w-5 h-5 text-amber-400 drop-shadow-md fill-amber-400" />
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[10px] font-bold shadow">
                    {remoteCursor.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: Vertical Participant Strip (compact column on right) */}
        <div className="w-56 lg:w-64 h-full flex flex-col gap-3 overflow-y-auto shrink-0 pr-1">
          {/* Local User (showing webcam stream or avatar, NOT duplicating screen share) */}
          <div className="w-full h-36 shrink-0">
            <ZoomVideoTile
              name={localUser.name}
              stream={localStream}
              isLocal={true}
              isHost={localUser.isHost}
              isAudioOn={isAudioOn}
              isVideoOn={isVideoOn}
              isScreenSharing={false}
              isSpeaking={speakingUserId === localUser.id}
              onPinToggle={() => setPinnedId(localUser.id)}
            />
          </div>

          {/* Remote Peers */}
          {peerList.map((p) => (
            <div key={p.id} className="w-full h-36 shrink-0">
              <ZoomVideoTile
                name={p.name}
                stream={p.stream}
                isHost={p.isHost}
                isAudioOn={p.isAudioOn}
                isVideoOn={p.isVideoOn ?? true}
                isScreenSharing={false}
                isSpeaking={speakingUserId === p.id}
                onPinToggle={() => setPinnedId(p.id)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. ZOOM GALLERY GRID: Full-Screen Edge-to-Edge
  return (
    <div className="absolute inset-0 w-full h-full p-6 pt-16 pb-24 flex items-center justify-center">
      <div
        className={`w-full h-full grid gap-4 transition-all duration-300 ${
          totalCount === 1
            ? 'grid-cols-1'
            : totalCount === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : totalCount <= 4
            ? 'grid-cols-2 grid-rows-2'
            : 'grid-cols-2 md:grid-cols-3'
        }`}
      >
        {/* Local user tile */}
        <ZoomVideoTile
          name={localUser.name}
          stream={screenStream || localStream}
          isLocal={true}
          isHost={localUser.isHost}
          isAudioOn={isAudioOn}
          isVideoOn={isVideoOn}
          isScreenSharing={isScreenSharing}
          isSpeaking={speakingUserId === localUser.id}
          onPinToggle={() => setPinnedId(localUser.id)}
        />

        {/* Remote peers tiles */}
        {peerList.map((peer) => (
          <ZoomVideoTile
            key={peer.id}
            name={peer.name}
            stream={peer.stream}
            isHost={peer.isHost}
            isAudioOn={peer.isAudioOn}
            isVideoOn={peer.isVideoOn}
            isScreenSharing={peer.isScreenSharing}
            isSpeaking={speakingUserId === peer.id}
            onPinToggle={() => setPinnedId(peer.id)}
          />
        ))}
      </div>
    </div>
  );
}
