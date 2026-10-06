'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
import { MousePointer, ShieldAlert, Monitor, Check, X, Play, Pause, Clapperboard } from 'lucide-react';
import P2PVideoTile from './P2PVideoTile';

export default function P2PGrid({
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
  onStopWatchTogether,
  isMobile: propIsMobile,
  isMobileLandscape: propIsMobileLandscape
}) {
  const [pinnedId, setPinnedId] = useState(null);
  const [showGrantMenu, setShowGrantMenu] = useState(false);
  const [mobileSwapPip, setMobileSwapPip] = useState(false);
  const [pipMinimized, setPipMinimized] = useState(false);
  const [localIsMobile, setLocalIsMobile] = useState(false);
  const [localIsLandscape, setLocalIsLandscape] = useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
      const isLand = (h < 550 && w < 1024) || (isTouch && h < 600 && w > h);
      setLocalIsLandscape(isLand || w > h);
      setLocalIsMobile(w < 768 || isLand || (isTouch && w < 1024));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isMobile = propIsMobile ?? localIsMobile;
  const isMobileLandscape = propIsMobileLandscape ?? localIsLandscape;

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

  // -------------------------------------------------------------
  // MOBILE DEDICATED LAYOUTS (Native Zoom/Teams/FaceTime Model)
  // -------------------------------------------------------------
  if (isMobile) {
    // 1. Mobile Screen Share / Presentation Mode: 100% Fullscreen Presentation Edge-to-Edge
    if (heroTile || watchTogetherState?.active) {
      const pipStream = heroTile?.isLocal ? (peerList[0]?.stream || null) : (screenStream || localStream);
      const pipName = heroTile?.isLocal ? (peerList[0]?.name || 'Peer') : localUser.name;

      return (
        <div className={`absolute inset-0 w-full h-full bg-black overflow-hidden flex flex-col ${
          isMobileLandscape ? 'p-0' : 'pt-10 pb-16'
        } select-none`}>
          {/* Main Stage: 100% full width and height with zero wasted space */}
          <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center bg-black">
            {watchTogetherState?.active ? (
              <video
                src={watchTogetherState.url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <P2PVideoTile
                name={heroTile.name}
                stream={heroTile.stream}
                isLocal={heroTile.isLocal}
                isHost={heroTile.isHost}
                isAudioOn={true}
                isVideoOn={true}
                isScreenSharing={heroTile.isScreenSharing}
                isSpeaking={false}
              />
            )}

            {/* In portrait: helper tip to rotate phone */}
            {!isMobileLandscape && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] text-[#F5E8D8]/70 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                <span>🔄 Rotate phone sideways for fullscreen</span>
              </div>
            )}

            {/* Corner floating PiP camera */}
            {pipStream && !pipMinimized && (
              <div
                onClick={() => setPipMinimized(true)}
                className={`absolute z-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-[#242424] cursor-pointer active:scale-95 transition-transform ${
                  isMobileLandscape
                    ? 'bottom-3 right-3 w-32 h-20'
                    : 'bottom-4 right-3 w-26 h-36'
                }`}
                title="Tap to minimize PiP"
              >
                <P2PVideoTile
                  name={pipName}
                  stream={pipStream}
                  isLocal={!heroTile?.isLocal}
                  isAudioOn={isAudioOn}
                  isVideoOn={isVideoOn}
                  isScreenSharing={false}
                />
              </div>
            )}

            {/* Mini PiP restore pill if minimized */}
            {pipStream && pipMinimized && (
              <button
                onClick={() => setPipMinimized(false)}
                className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-[11px] text-[#F5E8D8] flex items-center gap-1.5 shadow-2xl active:scale-95 transition"
              >
                <span>📷 Show Camera</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    // 2. Mobile 1-on-1 Call: Fullscreen remote peer with floating self camera PiP (Tap to swap!)
    if (totalCount === 2) {
      const remotePeer = peerList[0];
      const mainIsRemote = !mobileSwapPip;
      const mainUser = mainIsRemote ? remotePeer : { ...localUser, stream: localStream, isLocal: true, isAudioOn, isVideoOn };
      const pipUser = mainIsRemote ? { ...localUser, stream: localStream, isLocal: true, isAudioOn, isVideoOn } : remotePeer;

      return (
        <div className={`absolute inset-0 w-full h-full bg-[#1C1C1C] overflow-hidden flex flex-col ${
          isMobileLandscape ? 'p-0' : 'pt-10 pb-16'
        } select-none`}>
          {/* Full-Screen Main Video */}
          <div className="relative flex-1 w-full h-full overflow-hidden">
            <P2PVideoTile
              name={mainUser.name}
              stream={mainUser.stream}
              isLocal={mainUser.isLocal}
              isHost={mainUser.isHost}
              isAudioOn={mainUser.isAudioOn}
              isVideoOn={mainUser.isVideoOn}
              isSpeaking={speakingUserId === mainUser.id}
            />

            {/* Floating PiP Corner Tile (Tap to swap!) */}
            <div
              onClick={() => setMobileSwapPip(s => !s)}
              className={`absolute z-20 rounded-2xl overflow-hidden border-2 border-white/25 shadow-2xl active:scale-95 transition-transform cursor-pointer bg-[#242424] ${
                isMobileLandscape
                  ? 'bottom-3 right-3 w-32 h-20'
                  : 'bottom-4 right-3 w-26 h-36'
              }`}
              title="Tap to switch camera view"
            >
              <P2PVideoTile
                name={pipUser.name}
                stream={pipUser.stream}
                isLocal={pipUser.isLocal}
                isHost={pipUser.isHost}
                isAudioOn={pipUser.isAudioOn}
                isVideoOn={pipUser.isVideoOn}
                isSpeaking={speakingUserId === pipUser.id}
              />
              <div className="absolute top-1.5 right-1.5 px-1 py-0.2 rounded bg-black/60 text-[9px] text-white backdrop-blur-sm pointer-events-none">
                Swap ⇋
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. Mobile Multi-Person (> 2 people)
    if (totalCount > 2) {
      if (isMobileLandscape) {
        // Landscape Mode: 2-column or 3-column grid filling whole screen
        const allParticipants = [
          { id: localUser.id, name: `${localUser.name} (You)`, stream: localStream, isLocal: true, isAudioOn, isVideoOn },
          ...peerList
        ];
        return (
          <div className="absolute inset-0 w-full h-full bg-[#1C1C1C] overflow-hidden p-1.5 select-none">
            <div className={`grid ${totalCount <= 4 ? 'grid-cols-2' : 'grid-cols-3'} h-full w-full gap-1.5`}>
              {allParticipants.map(p => (
                <div key={p.id} className="relative w-full h-full min-h-0 rounded-xl overflow-hidden border border-[#F5E8D8]/10 bg-[#242424]">
                  <P2PVideoTile
                    name={p.name}
                    stream={p.stream}
                    isLocal={p.isLocal}
                    isHost={p.isHost}
                    isAudioOn={p.isAudioOn}
                    isVideoOn={p.isVideoOn}
                    isSpeaking={speakingUserId === p.id}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Portrait Mode: Active speaker large on top, clean carousel below
      const activePeer = peerList.find(p => p.id === speakingUserId) || peerList[0];
      const otherPeers = [
        { id: localUser.id, name: `${localUser.name} (You)`, stream: localStream, isLocal: true, isAudioOn, isVideoOn },
        ...peerList.filter(p => p.id !== activePeer.id)
      ];

      return (
        <div className="absolute inset-0 w-full h-full bg-[#1C1C1C] overflow-hidden flex flex-col pt-10 pb-16 select-none gap-2 px-2">
          {/* Main Speaker Stage */}
          <div className="relative flex-1 w-full min-h-0 rounded-2xl overflow-hidden border border-[#F5E8D8]/10 bg-[#242424]">
            <P2PVideoTile
              name={activePeer.name}
              stream={activePeer.stream}
              isHost={activePeer.isHost}
              isAudioOn={activePeer.isAudioOn}
              isVideoOn={activePeer.isVideoOn}
              isSpeaking={speakingUserId === activePeer.id}
            />
          </div>

          {/* Horizontal Carousel for other participants */}
          <div className="h-28 w-full flex flex-row gap-2 overflow-x-auto overflow-y-hidden shrink-0">
            {otherPeers.map(p => (
              <div key={p.id} className="w-32 h-full shrink-0 rounded-xl overflow-hidden border border-white/10">
                <P2PVideoTile
                  name={p.name}
                  stream={p.stream}
                  isLocal={p.isLocal}
                  isHost={p.isHost}
                  isAudioOn={p.isAudioOn}
                  isVideoOn={p.isVideoOn}
                  isSpeaking={speakingUserId === p.id}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 4. Solo in room on Mobile (1 person): Clean fullscreen self view
    return (
      <div className={`absolute inset-0 w-full h-full bg-[#1C1C1C] overflow-hidden flex flex-col ${
        isMobileLandscape ? 'p-0' : 'pt-10 pb-16'
      } select-none`}>
        <div className="relative flex-1 w-full h-full overflow-hidden">
          <P2PVideoTile
            name={localUser.name}
            stream={localStream}
            isLocal={true}
            isHost={localUser.isHost}
            isAudioOn={isAudioOn}
            isVideoOn={isVideoOn}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DESKTOP LAYOUTS (Screens >= md)
  // -------------------------------------------------------------

  // 1. P2P SIDE-BY-SIDE PRESENTATION MODE (Screen Sharing / Watch Together / Pinned Hero)
  if (heroTile || watchTogetherState?.active) {
    return (
      <div className="absolute inset-0 w-full h-full p-2 sm:p-3 pt-14 pb-20 sm:pt-16 sm:pb-24 flex flex-col md:flex-row gap-2 sm:gap-3">
        {/* LEFT / CENTER: Huge Main Presentation Stage */}
        <div className="flex-1 min-h-0 w-full flex flex-col relative rounded-2xl overflow-hidden bg-[#1C1C1C] border border-[#F5E8D8]/10 shadow-2xl">
          {/* Top Bar for Remote Access Controls */}
          {heroTile && (
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1C1C1C]/85 backdrop-blur-md border border-[#F5E8D8]/10 text-xs font-semibold text-[#F5E8D8] pointer-events-auto shadow-lg">
                <Monitor className="w-3.5 h-3.5 text-[#DAA520]" />
                <span>Viewing: {heroTile.name}</span>
                {heroTile.isLocal && (
                  <span className="text-[10px] bg-[#DAA520]/20 text-[#DAA520] border border-[#DAA520]/30 px-1.5 py-0.5 rounded font-bold">
                    You are sharing
                  </span>
                )}
              </div>

              {/* Remote Desktop Access Controls (RemoteDesk + Zoom) */}
              <div className="pointer-events-auto flex items-center gap-2">
                {/* 1. Host: Someone requested remote desktop control */}
                {isScreenSharing && remoteControlState?.requestPending && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#DAA520] text-[#1C1C1C] text-xs font-bold shadow-2xl animate-bounce">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{remoteControlState.requesterName} requests Remote Access</span>
                    <button
                      onClick={() => onGrantRemoteControl?.(true)}
                      className="px-2.5 py-1 rounded-lg bg-[#1C1C1C] text-[#F5E8D8] hover:bg-black transition"
                    >
                      Allow
                    </button>
                    <button
                      onClick={() => onGrantRemoteControl?.(false)}
                      className="px-2.5 py-1 rounded-lg bg-[#F5E8D8]/80 text-[#1C1C1C] hover:bg-[#F5E8D8] transition"
                    >
                      Deny
                    </button>
                  </div>
                )}

                {/* 2. Host: Someone is actively controlling */}
                {isScreenSharing && remoteControlState?.isBeingControlled && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FF6F61] text-[#1C1C1C] text-xs font-bold shadow-lg border border-[#FF6F61]/40">
                    <MousePointer className="w-3.5 h-3.5 animate-pulse" />
                    <span>Controlled by {remoteControlState.controllerName}</span>
                    <button
                      onClick={onRevokeRemoteControl}
                      className="px-2.5 py-1 rounded-lg bg-[#FF4500] hover:bg-[#FF4500]/80 text-white transition text-xs shadow"
                    >
                      Revoke Control
                    </button>
                  </div>
                )}

                {/* 3. Host: Ready for remote access */}
                {isScreenSharing && !remoteControlState?.isBeingControlled && !remoteControlState?.requestPending && (
                  <div className="relative flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#242424]/90 border border-[#F5E8D8]/12 text-[#F5E8D8] text-xs font-medium backdrop-blur-md">
                      <span className="w-2 h-2 rounded-full bg-[#DAA520] animate-pulse" />
                      <span>Remote Access Ready</span>
                    </div>

                    {peerList.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowGrantMenu(!showGrantMenu)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#FF6F61] hover:bg-[#FF4500] text-[#1C1C1C] hover:text-white text-xs font-semibold shadow transition"
                        >
                          Give Control ▾
                        </button>
                        {showGrantMenu && (
                          <div className="absolute right-0 top-10 w-48 rounded-xl bg-[#242424] border border-[#F5E8D8]/15 p-2 text-xs shadow-2xl z-50">
                            <span className="text-[10px] font-bold text-[#F5E8D8]/50 block px-2 mb-1 uppercase tracking-wider">Select User</span>
                            {peerList.map(p => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  onGrantRemoteControlToPeer?.(p.id, p.name);
                                  setShowGrantMenu(false);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-[#F5E8D8] transition"
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
                      className="px-2.5 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2C2C2C] text-[#F5E8D8] text-xs font-medium border border-[#F5E8D8]/12 transition"
                    >
                      Test Remote Cursor
                    </button>
                  </div>
                )}

                {/* 4. Viewer on shared screen: Can request or release control */}
                {!isScreenSharing && heroTile.id !== localUser.id && (
                  <div>
                    {remoteControlState?.isControlling ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#DAA520] text-[#1C1C1C] text-xs font-bold shadow-lg border border-[#DAA520]/40">
                        <MousePointer className="w-3.5 h-3.5 animate-bounce" />
                        <span>Remote Control Active (Click & Move on Screen)</span>
                        <button
                          onClick={onRevokeRemoteControl}
                          className="px-2.5 py-1 rounded-lg bg-[#FF4500] hover:bg-[#FF4500]/80 text-white transition text-xs shadow"
                        >
                          Release Control
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={onRequestRemoteControl}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FF6F61] hover:bg-[#FF4500] text-[#1C1C1C] hover:text-white text-xs font-bold backdrop-blur-md shadow-lg shadow-[#FF6F61]/20 transition"
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
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1C1C1C] relative">
              <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1C1C1C]/85 backdrop-blur-md border border-[#F5E8D8]/10 text-xs font-semibold text-[#F5E8D8] pointer-events-auto shadow-lg">
                  <Clapperboard className="w-3.5 h-3.5 text-[#DAA520]" />
                  <span>Watch Party (Synchronized Co-Streaming)</span>
                </div>
                <button
                  onClick={onStopWatchTogether}
                  className="pointer-events-auto px-3 py-1.5 rounded-xl bg-[#FF4500] hover:bg-[#FF4500]/80 text-white text-xs font-bold shadow transition"
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
              <P2PVideoTile
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
                  className="absolute pointer-events-none rounded-full border-2 border-[#DAA520] bg-[#DAA520]/30 animate-ping -translate-x-1/2 -translate-y-1/2 z-40"
                  style={{ top: `${r.y}%`, left: `${r.x}%`, width: '40px', height: '40px' }}
                />
              ))}

              {/* Virtual Remote Cursor Overlay */}
              {remoteCursor && (
                <div
                  className="absolute z-40 pointer-events-none transition-all duration-75 flex items-center gap-1 -translate-x-1 -translate-y-1"
                  style={{ top: `${remoteCursor.y}%`, left: `${remoteCursor.x}%` }}
                >
                  <MousePointer className="w-5 h-5 text-[#DAA520] drop-shadow-md fill-[#DAA520]" />
                  <span className="px-1.5 py-0.5 rounded bg-[#DAA520] text-[#1C1C1C] text-[10px] font-bold shadow">
                    {remoteCursor.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PARTICIPANT STRIP: Horizontal scroll on mobile, vertical sidebar on desktop */}
        <div className="w-full h-28 md:w-56 lg:w-64 md:h-full flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto overflow-y-hidden md:overflow-x-hidden shrink-0 py-1 md:py-0 pr-1">
          {/* Local User (showing webcam stream or avatar, NOT duplicating screen share) */}
          <div className="w-36 h-full md:w-full md:h-36 shrink-0">
            <P2PVideoTile
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
            <div key={p.id} className="w-36 h-full md:w-full md:h-36 shrink-0">
              <P2PVideoTile
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

  // 2. P2P GALLERY GRID: Full-Screen Edge-to-Edge with Header & Dock breathing room
  return (
    <div className="absolute inset-0 w-full h-full p-2 sm:p-3 pt-14 pb-20 sm:pt-16 sm:pb-24 flex items-center justify-center">
      <div
        className={`w-full h-full grid gap-2 sm:gap-3 transition-all duration-300 ${
          totalCount === 1
            ? 'grid-cols-1 grid-rows-1'
            : totalCount === 2
            ? 'grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1'
            : totalCount <= 4
            ? 'grid-cols-2 grid-rows-2'
            : 'grid-cols-2 sm:grid-cols-3'
        }`}
      >
        {/* Local user tile */}
        <P2PVideoTile
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
          <P2PVideoTile
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
