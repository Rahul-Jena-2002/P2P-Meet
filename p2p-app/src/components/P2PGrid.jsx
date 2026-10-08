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
  speakingUserIds = [], // Multi-speaker support
  raisedHands = [], // Hand raised user IDs
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
  const [gridOffset, setGridOffset] = useState(0);
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

  // Multi-Speaker Active Voice Helper
  const isUserSpeaking = (id) => {
    if (!id) return false;
    if (Array.isArray(speakingUserIds) && speakingUserIds.includes(id)) return true;
    if (speakingUserId === id) return true;
    return false;
  };

  // Distinct local tiles for camera and screen
  const localCameraTile = {
    id: localUser.id,
    peerId: localUser.id,
    name: localUser.name,
    stream: localStream,
    isLocal: true,
    isHost: localUser.isHost,
    isAudioOn,
    isVideoOn,
    isScreenSharing: false,
    isSpeaking: isUserSpeaking(localUser.id),
    isHandRaised: raisedHands.includes(localUser.id)
  };

  const localScreenTile = screenStream ? {
    id: `${localUser.id}-screen`,
    peerId: localUser.id,
    name: `${localUser.name} (Screen)`,
    stream: screenStream,
    isLocal: true,
    isHost: localUser.isHost,
    isAudioOn: true,
    isVideoOn: true,
    isScreenSharing: true,
    isSpeaking: false,
    isHandRaised: false
  } : null;

  // Remote camera tiles
  const remoteCameraTiles = peerList.map(p => ({
    id: p.id,
    peerId: p.id,
    name: p.name,
    stream: p.stream,
    isLocal: false,
    isHost: p.isHost,
    isAudioOn: p.isAudioOn,
    isVideoOn: p.isVideoOn,
    isScreenSharing: false,
    isSpeaking: isUserSpeaking(p.id),
    isHandRaised: raisedHands.includes(p.id)
  }));

  // Remote screen tiles (if peer is sharing screen via dual transceivers or fallback)
  const remoteScreenTiles = peerList
    .filter(p => p.isScreenSharing || p.screenStream)
    .map(p => ({
      id: `${p.id}-screen`,
      peerId: p.id,
      name: `${p.name} (Screen)`,
      stream: p.screenStream || p.stream,
      isLocal: false,
      isHost: p.isHost,
      isAudioOn: true,
      isVideoOn: true,
      isScreenSharing: true,
      isSpeaking: false,
      isHandRaised: false
    }));

  const allTiles = [
    localCameraTile,
    ...(localScreenTile ? [localScreenTile] : []),
    ...remoteScreenTiles,
    ...remoteCameraTiles
  ];

  const sharingTile = (isScreenSharing && localScreenTile)
    ? localScreenTile
    : (remoteScreenTiles[0] || null);

  // 1. PIN has HIGHEST priority (Zoom model: user pin overrides default sharing/speaker view)
  // 1. PIN has HIGHEST priority (Zoom model: user pin overrides default sharing/speaker view)
  let heroTile = null;
  if (pinnedId) {
    heroTile = allTiles.find(t => t.id === pinnedId) || peers[pinnedId] || null;
  }

  // If pinned source disappears, automatically clear the pin and return to normal layout
  React.useEffect(() => {
    if (pinnedId && !allTiles.some(t => t.id === pinnedId)) {
      setPinnedId(null);
    }
  }, [pinnedId, allTiles]);

  // 2. If nothing pinned, active screen share becomes the hero presentation
  if (!heroTile && sharingTile) {
    heroTile = sharingTile;
  }

  // 3. If in speaker mode and no share/pin, highlight the active speaker or first peer
  if (!heroTile && viewMode === 'speaker') {
    const speakerPeer = remoteCameraTiles.find(p => isUserSpeaking(p.id));
    heroTile = speakerPeer || (remoteCameraTiles.length > 0 ? remoteCameraTiles[0] : null);
  }

  // Side tiles in presentation layout (up to 8 other sources as secondary cards)
  const sideTiles = allTiles.filter(t => t.id !== heroTile?.id).slice(0, 8);

  const totalCount = allTiles.length;

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
      const pipStream = heroTile?.isLocal
        ? (remoteCameraTiles[0]?.stream || null)
        : (heroTile?.isScreenSharing ? (peers[heroTile.peerId]?.stream || localStream) : (screenStream || localStream));
      const pipName = heroTile?.isLocal
        ? (remoteCameraTiles[0]?.name || 'Peer')
        : (heroTile?.isScreenSharing ? (peers[heroTile.peerId]?.name || localUser.name) : localUser.name);

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
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3 py-1 rounded-full bg-[#0D0B14]/80 border border-[#C4B5FD]/20 text-[10px] text-[#C4B5FD] backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                <span>🔄 Rotate phone sideways for fullscreen</span>
              </div>
            )}

            {/* Corner floating PiP camera */}
            {pipStream && !pipMinimized && (
              <div
                onClick={() => setPipMinimized(true)}
                className={`absolute z-20 rounded-2xl overflow-hidden border-2 border-[#C4B5FD]/30 shadow-2xl bg-[#161324] cursor-pointer active:scale-95 transition-transform ${
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
                className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-xl bg-[#161324]/90 backdrop-blur-md border border-[#C4B5FD]/25 text-[11px] text-[#F8F7FC] flex items-center gap-1.5 shadow-2xl active:scale-95 transition"
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
        <div className={`absolute inset-0 w-full h-full bg-[#0D0B14] overflow-hidden flex flex-col ${
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
              isSpeaking={isUserSpeaking(mainUser.id)}
              isPinned={pinnedId === mainUser.id}
              onPinToggle={() => setPinnedId(pinnedId === mainUser.id ? null : mainUser.id)}
            />

            {/* Floating PiP Corner Tile (Tap to swap!) */}
            <div
              onClick={() => setMobileSwapPip(s => !s)}
              className={`absolute z-20 rounded-2xl overflow-hidden border-2 border-[#C4B5FD]/35 shadow-2xl active:scale-95 transition-transform cursor-pointer bg-[#161324] ${
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
                isSpeaking={isUserSpeaking(pipUser.id)}
                isPinned={pinnedId === pipUser.id}
                onPinToggle={() => setPinnedId(pinnedId === pipUser.id ? null : pipUser.id)}
              />
              <div className="absolute top-1.5 right-1.5 px-1 py-0.2 rounded bg-black/60 text-[9px] text-[#C4B5FD] backdrop-blur-sm pointer-events-none">
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
          <div className="absolute inset-0 w-full h-full bg-[#0D0B14] overflow-hidden p-1.5 select-none">
            <div className={`grid ${totalCount <= 4 ? 'grid-cols-2' : 'grid-cols-3'} h-full w-full gap-1.5`}>
              {allParticipants.map(p => (
                <div key={p.id} className="relative w-full h-full min-h-0 rounded-xl overflow-hidden border border-[#C4B5FD]/15 bg-[#161324]">
                  <P2PVideoTile
                    name={p.name}
                    stream={p.stream}
                    isLocal={p.isLocal}
                    isHost={p.isHost}
                    isAudioOn={p.isAudioOn}
                    isVideoOn={p.isVideoOn}
                    isSpeaking={isUserSpeaking(p.id)}
                    isPinned={pinnedId === p.id}
                    onPinToggle={() => setPinnedId(pinnedId === p.id ? null : p.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Portrait Mode: Active speaker large on top, clean carousel below
      const activePeer = peerList.find(p => isUserSpeaking(p.id)) || peerList[0];
      const otherPeers = [
        { id: localUser.id, name: `${localUser.name} (You)`, stream: localStream, isLocal: true, isAudioOn, isVideoOn },
        ...peerList.filter(p => p.id !== activePeer.id)
      ];

      return (
        <div className="absolute inset-0 w-full h-full bg-[#0D0B14] overflow-hidden flex flex-col pt-10 pb-16 select-none gap-2 px-2">
          {/* Main Speaker Stage */}
          <div className="relative flex-1 w-full min-h-0 rounded-2xl overflow-hidden border border-[#C4B5FD]/15 bg-[#161324]">
            <P2PVideoTile
              name={activePeer.name}
              stream={activePeer.stream}
              isHost={activePeer.isHost}
              isAudioOn={activePeer.isAudioOn}
              isVideoOn={activePeer.isVideoOn}
              isSpeaking={isUserSpeaking(activePeer.id)}
              isPinned={pinnedId === activePeer.id}
              onPinToggle={() => setPinnedId(pinnedId === activePeer.id ? null : activePeer.id)}
            />
          </div>

          {/* Horizontal Carousel for other participants */}
          <div className="h-28 w-full flex flex-row gap-2 overflow-x-auto overflow-y-hidden shrink-0">
            {otherPeers.map(p => (
              <div key={p.id} className="w-32 h-full shrink-0 rounded-xl overflow-hidden border border-[#C4B5FD]/15 bg-[#161324]">
                <P2PVideoTile
                  name={p.name}
                  stream={p.stream}
                  isLocal={p.isLocal}
                  isHost={p.isHost}
                  isAudioOn={p.isAudioOn}
                  isVideoOn={p.isVideoOn}
                  isSpeaking={isUserSpeaking(p.id)}
                  isPinned={pinnedId === p.id}
                  onPinToggle={() => setPinnedId(pinnedId === p.id ? null : p.id)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 4. Solo in room on Mobile (1 person): Clean fullscreen self view
    return (
      <div className={`absolute inset-0 w-full h-full bg-[#0D0B14] overflow-hidden flex flex-col ${
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
        <div className="flex-1 min-h-0 w-full flex flex-col relative rounded-2xl overflow-hidden bg-[#0D0B14] border border-[#C4B5FD]/15 shadow-2xl shadow-black/80">
          {/* Top Bar for Remote Access Controls */}
          {heroTile && (
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#161324]/85 backdrop-blur-md border border-[#C4B5FD]/20 text-xs font-semibold text-[#F8F7FC] pointer-events-auto shadow-lg">
                <Monitor className="w-3.5 h-3.5 text-[#FFA14A]" />
                <span>{pinnedId ? `Pinned Focus: ${heroTile.name}` : `Viewing: ${heroTile.name}`}</span>
                {heroTile.isLocal && (
                  <span className="text-[10px] bg-[#FF6B35]/20 text-[#FFA14A] border border-[#FF6B35]/40 px-1.5 py-0.5 rounded font-bold">
                    {heroTile.isScreenSharing ? 'Your Screen' : 'You (Spotlight)'}
                  </span>
                )}
                {pinnedId && (
                  <button
                    onClick={() => setPinnedId(null)}
                    className="ml-2 px-2 py-0.5 rounded-lg bg-[#FF6B35]/25 hover:bg-[#FF6B35] text-[#FFA14A] hover:text-white border border-[#FF6B35]/40 text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    Unpin ✕
                  </button>
                )}
              </div>

              {/* Remote Desktop Access Controls (RemoteDesk + Zoom) */}
              <div className="pointer-events-auto flex items-center gap-2">
                {/* 1. Host: Someone requested remote desktop control */}
                {isScreenSharing && remoteControlState?.requestPending && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] text-xs font-bold shadow-2xl animate-bounce">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{remoteControlState.requesterName} requests Remote Access</span>
                    <button
                      onClick={() => onGrantRemoteControl?.(true)}
                      className="px-2.5 py-1 rounded-lg bg-[#0D0B14] text-[#F8F7FC] hover:bg-[#161324] transition"
                    >
                      Allow
                    </button>
                    <button
                      onClick={() => onGrantRemoteControl?.(false)}
                      className="px-2.5 py-1 rounded-lg bg-[#C4B5FD]/90 text-[#0D0B14] hover:bg-[#C4B5FD] transition"
                    >
                      Deny
                    </button>
                  </div>
                )}

                {/* 2. Host: Someone is actively controlling */}
                {isScreenSharing && remoteControlState?.isBeingControlled && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FF6B35] text-white text-xs font-bold shadow-lg shadow-[#FF6B35]/30 border border-[#FF6B35]/50">
                    <MousePointer className="w-3.5 h-3.5 animate-pulse" />
                    <span>Controlled by {remoteControlState.controllerName}</span>
                    <button
                      onClick={onRevokeRemoteControl}
                      className="px-2.5 py-1 rounded-lg bg-[#0D0B14] hover:bg-[#161324] border border-white/20 text-white transition text-xs shadow"
                    >
                      Revoke Control
                    </button>
                  </div>
                )}

                {/* 3. Host: Ready for remote access */}
                {isScreenSharing && !remoteControlState?.isBeingControlled && !remoteControlState?.requestPending && (
                  <div className="relative flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161324]/90 border border-[#C4B5FD]/15 text-[#F8F7FC] text-xs font-medium backdrop-blur-md">
                      <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-pulse" />
                      <span>Remote Access Ready</span>
                    </div>

                    {peerList.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowGrantMenu(!showGrantMenu)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#FF6B35] hover:bg-[#FFA14A] text-[#0D0B14] text-xs font-bold shadow transition"
                        >
                          Give Control ▾
                        </button>
                        {showGrantMenu && (
                          <div className="absolute right-0 top-10 w-48 rounded-xl bg-[#161324] border border-[#C4B5FD]/20 p-2 text-xs shadow-2xl backdrop-blur-xl z-50">
                            <span className="text-[10px] font-bold text-[#C4B5FD]/60 block px-2 mb-1 uppercase tracking-wider">Select User</span>
                            {peerList.map(p => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  onGrantRemoteControlToPeer?.(p.id, p.name);
                                  setShowGrantMenu(false);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-[#F8F7FC] transition"
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
                      className="px-2.5 py-1.5 rounded-xl bg-[#161324] hover:bg-[#221C35] text-[#F8F7FC] text-xs font-medium border border-[#C4B5FD]/15 transition"
                    >
                      Test Remote Cursor
                    </button>
                  </div>
                )}

                {/* 4. Viewer on shared screen: Can request or release control */}
                {!isScreenSharing && heroTile.id !== localUser.id && (
                  <div>
                    {remoteControlState?.isControlling ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#C4B5FD] text-[#0D0B14] text-xs font-bold shadow-lg border border-[#C4B5FD]/40">
                        <MousePointer className="w-3.5 h-3.5 animate-bounce" />
                        <span>Remote Control Active (Click & Move on Screen)</span>
                        <button
                          onClick={onRevokeRemoteControl}
                          className="px-2.5 py-1 rounded-lg bg-[#FF6B35] hover:bg-[#FFA14A] text-white transition text-xs shadow"
                        >
                          Release Control
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={onRequestRemoteControl}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FF6B35] hover:bg-[#FFA14A] text-[#0D0B14] text-xs font-bold backdrop-blur-md shadow-lg shadow-[#FF6B35]/25 transition"
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
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0D0B14] relative">
              <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#161324]/85 backdrop-blur-md border border-[#C4B5FD]/20 text-xs font-semibold text-[#F8F7FC] pointer-events-auto shadow-lg">
                  <Clapperboard className="w-3.5 h-3.5 text-[#FFA14A]" />
                  <span>Watch Party (Synchronized Co-Streaming)</span>
                </div>
                <button
                  onClick={onStopWatchTogether}
                  className="pointer-events-auto px-3 py-1.5 rounded-xl bg-[#FF6B35] hover:bg-[#FFA14A] text-white text-xs font-bold shadow transition"
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
            /* Main Shared Screen Presentation or Pinned Tile */
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
                isVideoOn={heroTile.isVideoOn ?? true}
                isScreenSharing={heroTile.isScreenSharing}
                isSpeaking={isUserSpeaking(heroTile.id)}
                isPinned={!!pinnedId}
                isHandRaised={raisedHands.includes(heroTile.id)}
                onPinToggle={() => setPinnedId(null)}
              />

              {/* Click Ripple Animations for Remote Desktop */}
              {remoteRipples?.map(r => (
                <div
                  key={r.id}
                  className="absolute pointer-events-none rounded-full border-2 border-[#FF6B35] bg-[#FF6B35]/30 animate-ping -translate-x-1/2 -translate-y-1/2 z-40"
                  style={{ top: `${r.y}%`, left: `${r.x}%`, width: '40px', height: '40px' }}
                />
              ))}

              {/* Virtual Remote Cursor Overlay */}
              {remoteCursor && (
                <div
                  className="absolute z-40 pointer-events-none transition-all duration-75 flex items-center gap-1 -translate-x-1 -translate-y-1"
                  style={{ top: `${remoteCursor.y}%`, left: `${remoteCursor.x}%` }}
                >
                  <MousePointer className="w-5 h-5 text-[#FF6B35] drop-shadow-md fill-[#FF6B35]" />
                  <span className="px-1.5 py-0.5 rounded bg-[#FF6B35] text-[#0D0B14] text-[10px] font-bold shadow">
                    {remoteCursor.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PARTICIPANT STRIP: Multi-camera & Screen thumbnail filmstrip */}
        <div className="w-full h-28 md:w-56 lg:w-64 md:h-full flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto overflow-y-hidden md:overflow-x-hidden shrink-0 py-1 md:py-0 pr-1">
          {sideTiles.map((tile) => (
            <div key={tile.id} className="w-36 h-full md:w-full md:h-36 shrink-0">
              <P2PVideoTile
                name={tile.name}
                stream={tile.stream}
                isLocal={tile.isLocal}
                isHost={tile.isHost}
                isAudioOn={tile.isAudioOn}
                isVideoOn={tile.isVideoOn ?? true}
                isScreenSharing={tile.isScreenSharing}
                isSpeaking={isUserSpeaking(tile.id)}
                isPinned={false}
                isHandRaised={raisedHands.includes(tile.id)}
                onPinToggle={() => setPinnedId(tile.id)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. P2P GALLERY GRID: Full-Screen Edge-to-Edge with 3x3 Adaptive 9-Card Grid
  const maxGridCards = 9;
  const visibleGridTiles = allTiles.slice(gridOffset, gridOffset + maxGridCards);
  const hasPrev = gridOffset > 0;
  const hasNext = gridOffset + maxGridCards < allTiles.length;

  return (
    <div className="absolute inset-0 w-full h-full p-2 sm:p-3 pt-14 pb-20 sm:pt-16 sm:pb-24 flex items-center justify-center">
      {hasPrev && (
        <button
          onClick={() => setGridOffset(Math.max(0, gridOffset - maxGridCards))}
          title="Previous sources"
          className="absolute left-3 z-30 p-3 rounded-full bg-[#161324]/80 hover:bg-[#221C35] border border-[#C4B5FD]/25 text-[#F8F7FC] backdrop-blur-md transition shadow-2xl active:scale-95"
        >
          ‹
        </button>
      )}

      <div
        className={`w-full h-full grid gap-2 sm:gap-3 transition-all duration-300 ${
          visibleGridTiles.length === 1
            ? 'grid-cols-1 grid-rows-1'
            : visibleGridTiles.length === 2
            ? 'grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1'
            : visibleGridTiles.length <= 4
            ? 'grid-cols-2 grid-rows-2'
            : visibleGridTiles.length <= 6
            ? 'grid-cols-2 sm:grid-cols-3 grid-rows-2'
            : 'grid-cols-3 grid-rows-3'
        }`}
      >
        {visibleGridTiles.map((tile) => (
          <P2PVideoTile
            key={tile.id}
            name={tile.name}
            stream={tile.stream}
            isLocal={tile.isLocal}
            isHost={tile.isHost}
            isAudioOn={tile.isAudioOn}
            isVideoOn={tile.isVideoOn ?? true}
            isScreenSharing={tile.isScreenSharing}
            isSpeaking={tile.isSpeaking}
            isPinned={pinnedId === tile.id}
            isHandRaised={tile.isHandRaised}
            onPinToggle={() => setPinnedId(pinnedId === tile.id ? null : tile.id)}
          />
        ))}
      </div>

      {hasNext && (
        <button
          onClick={() => setGridOffset(gridOffset + maxGridCards)}
          title="More sources"
          className="absolute right-3 z-30 p-3 rounded-full bg-[#161324]/80 hover:bg-[#221C35] border border-[#C4B5FD]/25 text-[#F8F7FC] backdrop-blur-md transition shadow-2xl active:scale-95"
        >
          ›
        </button>
      )}
    </div>
  );
}
