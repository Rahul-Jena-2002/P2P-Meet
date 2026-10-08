'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
import { MousePointer, ShieldAlert, Monitor, Check, X, Play, Pause, Clapperboard, Users } from 'lucide-react';
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
  controlsVisible = true,
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
        <div className="absolute inset-0 w-full h-full bg-[#0D0B14] overflow-hidden flex flex-col p-0 select-none">
          {/* Main Stage: 100% full width and height with zero wasted space */}
          <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center bg-[#0D0B14]">
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
                isSingle={true}
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
      <div className="absolute inset-0 w-full h-full bg-[#0D0B14] overflow-hidden flex flex-col p-0 select-none">
        <div className="relative flex-1 w-full h-full overflow-hidden">
          <P2PVideoTile
            name={localUser.name}
            stream={localStream}
            isLocal={true}
            isHost={localUser.isHost}
            isAudioOn={isAudioOn}
            isVideoOn={isVideoOn}
            isSingle={true}
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
    const hasSideTiles = sideTiles.length > 0;
    return (
      <div className="absolute inset-0 w-full h-full p-0 overflow-hidden bg-[#0D0B14] select-none flex flex-row">
        {/* Main Presentation Stage (fills available width) */}
        <div className="flex-1 h-full min-w-0 overflow-hidden bg-[#0D0B14] relative">
          {watchTogetherState?.active ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0D0B14] relative">
              <div className="absolute top-16 left-4 z-30 flex items-center gap-2 pointer-events-auto">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D0B14]/60 backdrop-blur-xl border border-[#FF6B35]/70 text-xs font-semibold text-[#F8F7FC] shadow-lg">
                  <Clapperboard className="w-3.5 h-3.5 text-[#FFA14A]" />
                  <span>Watch Party (Co-Streaming)</span>
                </div>
                <button
                  onClick={onStopWatchTogether}
                  className="px-3 py-1.5 rounded-full bg-[#FF6B35] hover:bg-[#FFA14A] text-[#0D0B14] text-xs font-bold shadow transition cursor-pointer"
                >
                  End Party
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
                isSingle={true}
                onPinToggle={() => setPinnedId(null)}
              />

              {/* Click Ripple Animations for Remote Desktop */}
              {remoteRipples?.map(r => (
                <div
                  key={r.id}
                  className="absolute pointer-events-none rounded-full border border-[#FF6B35] bg-[#FF6B35]/30 animate-ping -translate-x-1/2 -translate-y-1/2 z-40"
                  style={{ top: `${r.y}%`, left: `${r.x}%`, width: '40px', height: '40px' }}
                />
              ))}

              {/* Virtual Remote Cursor Overlay (Only for remote peers controlling a remote screen - never on own screen) */}
              {remoteCursor && !heroTile?.isLocal && (
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

        {/* Presentation Status Bar - Floats at top-16 left-4 (BELOW Top Header, auto-hides with controlsVisible) */}
        {heroTile && !watchTogetherState?.active && (
          <div className={`absolute top-16 left-4 z-20 flex flex-wrap items-center gap-2 transition-all duration-300 ${
            controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D0B14]/60 backdrop-blur-xl border border-[#FF6B35]/70 text-xs font-semibold text-[#F8F7FC] shadow-lg">
              <Monitor className="w-3.5 h-3.5 text-[#FFA14A]" />
              <span>{pinnedId ? `Pinned: ${heroTile.name}` : `Viewing: ${heroTile.name}`}</span>
              {heroTile.isLocal && (
                <span className="text-[10px] bg-[#FF6B35]/20 text-[#FFA14A] border border-[#FF6B35]/40 px-1.5 py-0.5 rounded-full font-bold">
                  {heroTile.isScreenSharing ? 'Your Screen' : 'You'}
                </span>
              )}
              {pinnedId && (
                <button
                  onClick={() => setPinnedId(null)}
                  className="ml-1 px-2 py-0.5 rounded-full bg-[#FF6B35]/25 hover:bg-[#FF6B35] text-[#FFA14A] hover:text-[#0D0B14] border border-[#FF6B35]/40 text-[10px] font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  Unpin ✕
                </button>
              )}
            </div>

            {/* Remote Desktop Access Controls (Only shown when active or requested) */}
            {isScreenSharing && remoteControlState?.requestPending && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] text-xs font-bold shadow-lg animate-bounce">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{remoteControlState.requesterName} requests Access</span>
                <button
                  onClick={() => onGrantRemoteControl?.(true)}
                  className="px-2.5 py-1 rounded-full bg-[#0D0B14] text-[#F8F7FC] hover:bg-[#161324] transition text-xs font-semibold cursor-pointer"
                >
                  Allow
                </button>
                <button
                  onClick={() => onGrantRemoteControl?.(false)}
                  className="px-2.5 py-1 rounded-full bg-[#C4B5FD] text-[#0D0B14] hover:bg-[#F8F7FC] transition text-xs font-semibold cursor-pointer"
                >
                  Deny
                </button>
              </div>
            )}

            {isScreenSharing && remoteControlState?.isBeingControlled && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF6B35] text-[#0D0B14] text-xs font-bold shadow-lg">
                <MousePointer className="w-3.5 h-3.5 animate-pulse" />
                <span>Controlled by {remoteControlState.controllerName}</span>
                <button
                  onClick={onRevokeRemoteControl}
                  className="px-2.5 py-1 rounded-full bg-[#0D0B14] hover:bg-[#161324] text-white transition text-xs font-semibold cursor-pointer"
                >
                  Revoke
                </button>
              </div>
            )}

            {isScreenSharing && !remoteControlState?.isBeingControlled && !remoteControlState?.requestPending && peerList.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowGrantMenu(!showGrantMenu)}
                  className="px-3 py-1.5 rounded-full bg-[#0D0B14]/60 hover:bg-[#FF6B35]/25 border border-[#FF6B35]/70 text-[#FFA14A] hover:text-[#F8F7FC] text-xs font-semibold backdrop-blur-xl shadow transition cursor-pointer"
                >
                  Give Control ▾
                </button>
                {showGrantMenu && (
                  <div className="absolute left-0 top-10 w-48 rounded-2xl bg-[#161324]/95 border border-[#FF6B35]/70 p-2 text-xs shadow-2xl backdrop-blur-xl z-50">
                    <span className="text-[10px] font-bold text-[#FFA14A] block px-2 mb-1 uppercase tracking-wider">Select User</span>
                    {peerList.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onGrantRemoteControlToPeer?.(p.id, p.name);
                          setShowGrantMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] text-[#F8F7FC] transition cursor-pointer"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isScreenSharing && heroTile.id !== localUser.id && (
              <div>
                {remoteControlState?.isControlling ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFA14A] text-[#0D0B14] text-xs font-bold shadow-lg">
                    <MousePointer className="w-3.5 h-3.5 animate-bounce" />
                    <span>Remote Control Active</span>
                    <button
                      onClick={onRevokeRemoteControl}
                      className="px-2.5 py-1 rounded-full bg-[#0D0B14] hover:bg-[#161324] text-white transition text-xs font-semibold cursor-pointer"
                    >
                      Release
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onRequestRemoteControl}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FF6B35] hover:bg-[#FFA14A] text-[#0D0B14] text-xs font-bold backdrop-blur-md shadow-lg shadow-[#FF6B35]/25 transition cursor-pointer"
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                    <span>Request Control</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        </div>

        {/* DOCKED SIDEBAR FOR PEOPLE (PARTICIPANT CAMERAS) - SAME LIKE CHAT ON THE SIDE, NOT FLOATING! */}
        {hasSideTiles && (
          <aside className="w-56 sm:w-64 md:w-72 h-full bg-[#161324] border-l border-[#FF6B35]/40 flex flex-col shrink-0 z-20 select-none">
            <div className="h-12 px-3.5 border-b border-[rgba(196,181,253,0.14)] flex items-center justify-between shrink-0 bg-[#161324]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#FF6B35]/20 text-[#FFA14A] font-bold border border-[#FF6B35]/40 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>People ({sideTiles.length})</span>
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5">
              {sideTiles.map((tile) => (
                <div key={tile.id} className="w-full h-36 shrink-0 rounded-2xl overflow-hidden border border-[#FF6B35]/70 bg-[#0D0B14] relative shadow-lg">
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
          </aside>
        )}
      </div>
    );
  }

  // 2. P2P GALLERY GRID: Full-Screen Edge-to-Edge with 3x3 Adaptive 9-Card Grid
  const maxGridCards = 9;
  const visibleGridTiles = allTiles.slice(gridOffset, gridOffset + maxGridCards);
  const isSolo = visibleGridTiles.length === 1;
  const hasPrev = gridOffset > 0;
  const hasNext = gridOffset + maxGridCards < allTiles.length;

  return (
    <div className={`absolute inset-0 w-full h-full flex items-center justify-center ${
      isSolo ? 'p-0' : 'p-2 pt-13 pb-16 sm:pt-14 sm:pb-20'
    }`}>
      {hasPrev && (
        <button
          onClick={() => setGridOffset(Math.max(0, gridOffset - maxGridCards))}
          title="Previous sources"
          className="absolute left-3 z-30 p-3 rounded-full bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 border border-white/10 text-[#F8F7FC] backdrop-blur-xl transition shadow-2xl active:scale-95"
        >
          ‹
        </button>
      )}

      <div
        className={`w-full h-full grid transition-all duration-300 ${
          isSolo
            ? 'grid-cols-1 grid-rows-1 gap-0'
            : visibleGridTiles.length === 2
            ? 'grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1 gap-2 sm:gap-3'
            : visibleGridTiles.length <= 4
            ? 'grid-cols-2 grid-rows-2 gap-2 sm:gap-3'
            : visibleGridTiles.length <= 6
            ? 'grid-cols-2 sm:grid-cols-3 grid-rows-2 gap-2 sm:gap-3'
            : 'grid-cols-3 grid-rows-3 gap-2 sm:gap-3'
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
            isSingle={isSolo}
            onPinToggle={() => setPinnedId(pinnedId === tile.id ? null : tile.id)}
          />
        ))}
      </div>

      {hasNext && (
        <button
          onClick={() => setGridOffset(gridOffset + maxGridCards)}
          title="More sources"
          className="absolute right-3 z-30 p-3 rounded-full bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 border border-white/10 text-[#F8F7FC] backdrop-blur-xl transition shadow-2xl active:scale-95"
        >
          ›
        </button>
      )}
    </div>
  );
}
