'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useRef } from 'react';
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
  isMobileLandscape: propIsMobileLandscape,
  pinnedIds: propPinnedIds,
  onTogglePin: propTogglePin,
  onSetPinnedIds: propSetPinnedIds,
  onUnpinAll: propUnpinAll
}) {
  const [internalPinnedIds, setInternalPinnedIds] = useState([]);
  const pinnedIds = propPinnedIds ?? internalPinnedIds;
  const setPinnedIds = propSetPinnedIds ?? setInternalPinnedIds;

  const [splitRatio, setSplitRatio] = useState(50); // 50 / 50 draggable split
  const isDraggingSplitRef = useRef(false);
  const containerStageRef = useRef(null);

  const [draggedPinId, setDraggedPinId] = useState(null);
  const [dragOverPinId, setDragOverPinId] = useState(null);

  const togglePin = (id) => {
    if (!id) return;
    if (propTogglePin) {
      propTogglePin(id);
    } else {
      setPinnedIds(prev => {
        if (prev.includes(id)) return prev.filter(x => x !== id);
        if (prev.length >= 4) return [...prev.slice(0, 3), id]; // Max 4
        return [...prev, id];
      });
    }
  };

  const handleUnpinAll = () => {
    if (propUnpinAll) {
      propUnpinAll();
    } else {
      setPinnedIds([]);
    }
  };

  const handleSwapPinned = (srcId, tgtId) => {
    if (!srcId || !tgtId || srcId === tgtId) return;
    setPinnedIds(prev => {
      const srcIdx = prev.indexOf(srcId);
      const tgtIdx = prev.indexOf(tgtId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const copy = [...prev];
      copy[srcIdx] = tgtId;
      copy[tgtIdx] = srcId;
      return copy;
    });
  };

  const handleStartSplitDrag = (e) => {
    e.preventDefault();
    isDraggingSplitRef.current = true;

    const onMouseMove = (moveEvent) => {
      if (!isDraggingSplitRef.current || !containerStageRef.current) return;
      const rect = containerStageRef.current.getBoundingClientRect();
      const ratio = Math.max(20, Math.min(80, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      setSplitRatio(Math.round(ratio));
    };

    const onMouseUp = () => {
      isDraggingSplitRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

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

  // 1. Multi-Pin has HIGHEST priority (Up to 4 pinned tiles)
  const pinnedTiles = pinnedIds
    .map(id => allTiles.find(t => t.id === id) || peers[id])
    .filter(Boolean);

  // If pinned source disappears, automatically remove from pinnedIds
  React.useEffect(() => {
    if (pinnedIds.length > 0) {
      setPinnedIds(prev => prev.filter(id => allTiles.some(t => t.id === id) || !!peers[id]));
    }
  }, [pinnedIds.length, allTiles, peers]);

  let heroTile = null;
  if (pinnedTiles.length === 1) {
    heroTile = pinnedTiles[0];
  } else if (pinnedTiles.length === 0 && sharingTile) {
    heroTile = sharingTile;
  } else if (pinnedTiles.length === 0 && !heroTile && viewMode === 'speaker') {
    const speakerPeer = remoteCameraTiles.find(p => isUserSpeaking(p.id));
    heroTile = speakerPeer || (remoteCameraTiles.length > 0 ? remoteCameraTiles[0] : null);
  }

  const isMultiPinned = pinnedTiles.length >= 2;
  const isPresentingMode = pinnedTiles.length > 0 || !!heroTile || watchTogetherState?.active;

  const excludedIds = new Set(pinnedTiles.map(t => t.id));
  if (heroTile) excludedIds.add(heroTile.id);

  // Side tiles in presentation layout: only show participants whose camera is actively turned ON!
  const sideTiles = allTiles
    .filter(t => !excludedIds.has(t.id))
    .filter(t => {
      if (!t.isVideoOn) return false;
      const tracks = t.stream?.getVideoTracks();
      return tracks && tracks.length > 0 && tracks[0].readyState === 'live';
    })
    .slice(0, 8);

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
    // 0. Mobile Multi-Pinned Stage (2 to 4 pinned tiles)
    if (isMultiPinned) {
      return (
        <div className={`absolute inset-0 w-full h-full bg-[#0D0B14] overflow-hidden flex flex-col ${
          isMobileLandscape ? 'p-1' : 'pt-10 pb-16 px-1.5'
        } select-none`}>
          <div className={`w-full h-full grid ${
            pinnedTiles.length === 2
              ? (isMobileLandscape ? 'grid-cols-2 grid-rows-1' : 'grid-cols-1 grid-rows-2')
              : 'grid-cols-2 grid-rows-2'
          } gap-1.5`}>
            {pinnedTiles.slice(0, 4).map((tile, idx) => (
              <div key={tile.id} className="relative w-full h-full min-h-0 rounded-xl overflow-hidden border border-[#FF6B35]/30 bg-[#161324] shadow-md">
                <P2PVideoTile
                  name={tile.name}
                  stream={tile.stream}
                  isLocal={tile.isLocal}
                  isHost={tile.isHost}
                  isAudioOn={tile.isAudioOn}
                  isVideoOn={tile.isVideoOn ?? true}
                  isSpeaking={isUserSpeaking(tile.id)}
                  isPinned={true}
                  onPinToggle={() => togglePin(tile.id)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

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
                isPinned={pinnedIds.includes(heroTile.id)}
                onPinToggle={() => togglePin(heroTile.id)}
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
              isPinned={pinnedIds.includes(mainUser.id)}
              onPinToggle={() => togglePin(mainUser.id)}
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
                isPinned={pinnedIds.includes(pipUser.id)}
                onPinToggle={() => togglePin(pipUser.id)}
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
                    isPinned={pinnedIds.includes(p.id)}
                    onPinToggle={() => togglePin(p.id)}
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
              isPinned={pinnedIds.includes(activePeer.id)}
              onPinToggle={() => togglePin(activePeer.id)}
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
                  isPinned={pinnedIds.includes(p.id)}
                  onPinToggle={() => togglePin(p.id)}
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

  // 1. P2P SIDE-BY-SIDE PRESENTATION MODE (Screen Sharing / Watch Together / Multi-Pinned Hero)
  if (isPresentingMode) {
    const hasSideTiles = sideTiles.length > 0;
    const activeHero = pinnedTiles.length === 1 ? pinnedTiles[0] : heroTile;

    return (
      <div className="absolute inset-0 w-full h-full p-0 overflow-hidden bg-[#0D0B14] select-none flex flex-row">
        {/* Main Presentation Stage (fills available width) */}
        <div
          ref={containerStageRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const droppedId = e.dataTransfer.getData('text/plain');
            if (droppedId) togglePin(droppedId);
          }}
          className="flex-1 h-full min-w-0 overflow-hidden bg-[#0D0B14] relative"
        >
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
          ) : isMultiPinned ? (
            /* MULTI-PINNED STAGE (2: 50/50 with draggable divider | 3: Top 2 + Bottom 1 | 4: 4 Quadrants) */
            <div className="w-full h-full relative overflow-hidden bg-[#0D0B14]">
              {pinnedTiles.length === 2 ? (
                /* 2 TILES PINNED: 50% / 50% SPLIT WITH DRAGGABLE CENTER DIVIDER */
                <div className="w-full h-full flex flex-row items-center justify-center p-2 relative overflow-hidden select-none">
                  {/* Left 50% Quadrant */}
                  <div
                    style={{ width: `${splitRatio}%` }}
                    className={`h-full relative overflow-hidden transition-all duration-75 rounded-2xl border border-white/10 ${
                      dragOverPinId === pinnedTiles[0].id ? 'ring-2 ring-[#FF6B35] shadow-[0_0_24px_rgba(255,107,53,0.35)]' : ''
                    }`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedPinId(pinnedTiles[0].id);
                      e.dataTransfer.setData('text/plain', pinnedTiles[0].id);
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverPinId(pinnedTiles[0].id); }}
                    onDragLeave={() => setDragOverPinId(null)}
                    onDrop={() => {
                      handleSwapPinned(draggedPinId, pinnedTiles[0].id);
                      setDraggedPinId(null);
                      setDragOverPinId(null);
                    }}
                  >
                    <P2PVideoTile
                      name={pinnedTiles[0].name}
                      stream={pinnedTiles[0].stream}
                      isLocal={pinnedTiles[0].isLocal}
                      isHost={pinnedTiles[0].isHost}
                      isAudioOn={pinnedTiles[0].isAudioOn}
                      isVideoOn={pinnedTiles[0].isVideoOn ?? true}
                      isScreenSharing={pinnedTiles[0].isScreenSharing}
                      isSpeaking={isUserSpeaking(pinnedTiles[0].id)}
                      isPinned={true}
                      isHandRaised={raisedHands.includes(pinnedTiles[0].id)}
                      onPinToggle={() => togglePin(pinnedTiles[0].id)}
                    />
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-white/90 border border-white/10 pointer-events-none z-20">
                      Left ({splitRatio}%) • Drag to swap
                    </div>
                  </div>

                  {/* Draggable Divider Handle between 50 / 50 */}
                  <div
                    onMouseDown={handleStartSplitDrag}
                    onDoubleClick={() => setSplitRatio(50)}
                    className="w-2.5 h-full cursor-col-resize hover:bg-[#FF6B35]/50 active:bg-[#FF6B35] transition z-30 shrink-0 flex items-center justify-center select-none group"
                    title="Drag to resize 50/50 split (Double-click to reset)"
                  >
                    <div className="w-1 h-10 rounded-full bg-white/20 group-hover:bg-[#FF6B35] transition" />
                  </div>

                  {/* Right 50% Quadrant */}
                  <div
                    style={{ width: `${100 - splitRatio}%` }}
                    className={`h-full relative overflow-hidden transition-all duration-75 rounded-2xl border border-white/10 ${
                      dragOverPinId === pinnedTiles[1].id ? 'ring-2 ring-[#FF6B35] shadow-[0_0_24px_rgba(255,107,53,0.35)]' : ''
                    }`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedPinId(pinnedTiles[1].id);
                      e.dataTransfer.setData('text/plain', pinnedTiles[1].id);
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverPinId(pinnedTiles[1].id); }}
                    onDragLeave={() => setDragOverPinId(null)}
                    onDrop={() => {
                      handleSwapPinned(draggedPinId, pinnedTiles[1].id);
                      setDraggedPinId(null);
                      setDragOverPinId(null);
                    }}
                  >
                    <P2PVideoTile
                      name={pinnedTiles[1].name}
                      stream={pinnedTiles[1].stream}
                      isLocal={pinnedTiles[1].isLocal}
                      isHost={pinnedTiles[1].isHost}
                      isAudioOn={pinnedTiles[1].isAudioOn}
                      isVideoOn={pinnedTiles[1].isVideoOn ?? true}
                      isScreenSharing={pinnedTiles[1].isScreenSharing}
                      isSpeaking={isUserSpeaking(pinnedTiles[1].id)}
                      isPinned={true}
                      isHandRaised={raisedHands.includes(pinnedTiles[1].id)}
                      onPinToggle={() => togglePin(pinnedTiles[1].id)}
                    />
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-white/90 border border-white/10 pointer-events-none z-20">
                      Right ({100 - splitRatio}%) • Drag to swap
                    </div>
                  </div>
                </div>
              ) : pinnedTiles.length === 3 ? (
                /* 3 TILES PINNED: TOP-LEFT, TOP-RIGHT, BOTTOM SPANNING */
                <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2 p-2 relative overflow-hidden select-none">
                  {pinnedTiles.slice(0, 3).map((tile, idx) => {
                    const isBottom = idx === 2;
                    const labels = ['Top Left', 'Top Right', 'Bottom (Full)'];
                    return (
                      <div
                        key={tile.id}
                        className={`${isBottom ? 'col-span-2 row-span-1' : 'col-span-1 row-span-1'} h-full w-full relative overflow-hidden rounded-2xl border border-white/10 transition-all ${
                          dragOverPinId === tile.id ? 'ring-2 ring-[#FF6B35] shadow-[0_0_24px_rgba(255,107,53,0.35)]' : ''
                        }`}
                        draggable
                        onDragStart={(e) => {
                          setDraggedPinId(tile.id);
                          e.dataTransfer.setData('text/plain', tile.id);
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverPinId(tile.id); }}
                        onDragLeave={() => setDragOverPinId(null)}
                        onDrop={() => {
                          handleSwapPinned(draggedPinId, tile.id);
                          setDraggedPinId(null);
                          setDragOverPinId(null);
                        }}
                      >
                        <P2PVideoTile
                          name={tile.name}
                          stream={tile.stream}
                          isLocal={tile.isLocal}
                          isHost={tile.isHost}
                          isAudioOn={tile.isAudioOn}
                          isVideoOn={tile.isVideoOn ?? true}
                          isScreenSharing={tile.isScreenSharing}
                          isSpeaking={isUserSpeaking(tile.id)}
                          isPinned={true}
                          isHandRaised={raisedHands.includes(tile.id)}
                          onPinToggle={() => togglePin(tile.id)}
                        />
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-white/90 border border-white/10 pointer-events-none z-20">
                          {labels[idx]} • Drag to swap
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* 4 TILES PINNED: 4 QUADRANTS (TOP-LEFT, TOP-RIGHT, BOTTOM-LEFT, BOTTOM-RIGHT) */
                <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2 p-2 relative overflow-hidden select-none">
                  {pinnedTiles.slice(0, 4).map((tile, idx) => {
                    const quadrantNames = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'];
                    return (
                      <div
                        key={tile.id}
                        className={`col-span-1 row-span-1 h-full w-full relative overflow-hidden rounded-2xl border border-white/10 transition-all ${
                          dragOverPinId === tile.id ? 'ring-2 ring-[#FF6B35] shadow-[0_0_24px_rgba(255,107,53,0.35)]' : ''
                        }`}
                        draggable
                        onDragStart={(e) => {
                          setDraggedPinId(tile.id);
                          e.dataTransfer.setData('text/plain', tile.id);
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverPinId(tile.id); }}
                        onDragLeave={() => setDragOverPinId(null)}
                        onDrop={() => {
                          handleSwapPinned(draggedPinId, tile.id);
                          setDraggedPinId(null);
                          setDragOverPinId(null);
                        }}
                      >
                        <P2PVideoTile
                          name={tile.name}
                          stream={tile.stream}
                          isLocal={tile.isLocal}
                          isHost={tile.isHost}
                          isAudioOn={tile.isAudioOn}
                          isVideoOn={tile.isVideoOn ?? true}
                          isScreenSharing={tile.isScreenSharing}
                          isSpeaking={isUserSpeaking(tile.id)}
                          isPinned={true}
                          isHandRaised={raisedHands.includes(tile.id)}
                          onPinToggle={() => togglePin(tile.id)}
                        />
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-white/90 border border-white/10 pointer-events-none z-20">
                          {quadrantNames[idx]} • Drag to swap
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeHero ? (
            /* SINGLE HERO VIEW (1 PINNED OR SCREEN SHARE OR ACTIVE SPEAKER) */
            <div
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              className={`w-full h-full relative ${remoteControlState?.isControlling ? 'cursor-crosshair' : ''}`}
            >
              <P2PVideoTile
                name={activeHero.name}
                stream={activeHero.stream}
                isLocal={activeHero.isLocal}
                isHost={activeHero.isHost}
                isAudioOn={activeHero.isAudioOn}
                isVideoOn={activeHero.isVideoOn ?? true}
                isScreenSharing={activeHero.isScreenSharing}
                isSpeaking={isUserSpeaking(activeHero.id)}
                isPinned={pinnedIds.includes(activeHero.id)}
                isHandRaised={raisedHands.includes(activeHero.id)}
                isSingle={true}
                onPinToggle={() => togglePin(activeHero.id)}
              />

              {/* Click Ripple Animations for Remote Desktop */}
              {remoteRipples?.map(r => (
                <div
                  key={r.id}
                  className="absolute pointer-events-none rounded-full border border-[#FF6B35] bg-[#FF6B35]/30 animate-ping -translate-x-1/2 -translate-y-1/2 z-40"
                  style={{ top: `${r.y}%`, left: `${r.x}%`, width: '40px', height: '40px' }}
                />
              ))}

              {/* Virtual Remote Cursor Overlay */}
              {remoteCursor && !activeHero?.isLocal && (
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
          ) : null}

        {/* Remote Desktop Access Controls (Only shown when active or requested) */}
        {isScreenSharing && (remoteControlState?.requestPending || remoteControlState?.isBeingControlled || remoteControlState?.isControlling || showGrantMenu) && (
          <div className={`absolute top-16 left-4 z-20 flex flex-wrap items-center gap-2 transition-all duration-300 ${
            controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}>
            {remoteControlState?.requestPending && (
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

            {remoteControlState?.isBeingControlled && (
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

            {!remoteControlState?.isBeingControlled && !remoteControlState?.requestPending && peerList.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowGrantMenu(!showGrantMenu)}
                  className="px-3 py-1.5 rounded-full bg-[#0D0B14]/70 hover:bg-[#FF6B35]/25 border border-white/10 hover:border-[#FF6B35]/40 text-[#FFA14A] hover:text-[#F8F7FC] text-xs font-semibold backdrop-blur-xl shadow transition cursor-pointer"
                >
                  Give Control ▾
                </button>
                {showGrantMenu && (
                  <div className="absolute left-0 top-10 w-48 rounded-2xl bg-[#161324]/95 border border-white/15 p-2 text-xs shadow-2xl backdrop-blur-xl z-50">
                    <span className="text-[10px] font-bold text-[#FFA14A] block px-2 mb-1 uppercase tracking-wider">Select User</span>
                    {peerList.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onGrantRemoteControlToPeer?.(p.id, p.name);
                          setShowGrantMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/[0.08] text-[#F8F7FC] transition cursor-pointer"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>

        {/* DOCKED SIDEBAR FOR PEOPLE (ONLY PARTICIPANTS WITH LIVE VIDEO ON) */}
        {hasSideTiles && (
          <aside className="w-64 sm:w-72 h-full bg-[#13111E] border-l border-white/10 flex flex-col shrink-0 z-20 select-none shadow-2xl">
            <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#14121F]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FFA14A]" />
                <span className="text-xs font-semibold text-white/90">People ({sideTiles.length})</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5">
              {sideTiles.map((tile) => (
                <div
                  key={tile.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', tile.id);
                  }}
                  className="w-full h-36 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-[#0D0B14] relative shadow-md cursor-grab active:cursor-grabbing hover:border-[#FF6B35]/40 transition"
                  title="Drag tile to pin onto stage, or click pin icon"
                >
                  <P2PVideoTile
                    name={tile.name}
                    stream={tile.stream}
                    isLocal={tile.isLocal}
                    isHost={tile.isHost}
                    isAudioOn={tile.isAudioOn}
                    isVideoOn={true}
                    isScreenSharing={tile.isScreenSharing}
                    isSpeaking={isUserSpeaking(tile.id)}
                    isPinned={pinnedIds.includes(tile.id)}
                    isHandRaised={raisedHands.includes(tile.id)}
                    onPinToggle={() => togglePin(tile.id)}
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
          <div
            key={tile.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', tile.id);
            }}
            className="w-full h-full relative"
          >
            <P2PVideoTile
              name={tile.name}
              stream={tile.stream}
              isLocal={tile.isLocal}
              isHost={tile.isHost}
              isAudioOn={tile.isAudioOn}
              isVideoOn={tile.isVideoOn ?? true}
              isScreenSharing={tile.isScreenSharing}
              isSpeaking={tile.isSpeaking}
              isPinned={pinnedIds.includes(tile.id)}
              isHandRaised={tile.isHandRaised}
              isSingle={isSolo}
              onPinToggle={() => togglePin(tile.id)}
            />
          </div>
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
