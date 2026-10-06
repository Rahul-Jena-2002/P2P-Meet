'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
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
  speakingUserId
}) {
  const [pinnedId, setPinnedId] = useState(null);

  const peerList = Object.values(peers);
  const totalCount = 1 + peerList.length;

  // Active or pinned item for speaker stage mode
  const activeTile = pinnedId
    ? (pinnedId === localUser.id
        ? { id: localUser.id, name: localUser.name, stream: screenStream || localStream, isLocal: true, isHost: localUser.isHost, isAudioOn, isVideoOn, isScreenSharing }
        : peers[pinnedId])
    : (isScreenSharing
        ? { id: localUser.id, name: `${localUser.name} (Screen)`, stream: screenStream, isLocal: true, isHost: localUser.isHost, isAudioOn, isVideoOn, isScreenSharing: true }
        : null);

  // If in Speaker/Stage view OR a video is pinned
  if (viewMode === 'speaker' || activeTile) {
    const heroTile = activeTile || (peerList.length > 0 ? peerList[0] : {
      id: localUser.id,
      name: localUser.name,
      stream: screenStream || localStream,
      isLocal: true,
      isHost: localUser.isHost,
      isAudioOn,
      isVideoOn,
      isScreenSharing
    });

    return (
      <div className="absolute inset-0 w-full h-full p-4 pt-20 pb-24 flex flex-col gap-3">
        {/* Main Stage */}
        <div className="flex-1 w-full h-full min-h-0">
          <ZoomVideoTile
            name={heroTile.name}
            stream={heroTile.stream}
            isLocal={heroTile.isLocal}
            isHost={heroTile.isHost}
            isAudioOn={heroTile.isAudioOn}
            isVideoOn={heroTile.isVideoOn}
            isScreenSharing={heroTile.isScreenSharing}
            isSpeaking={speakingUserId === heroTile.id}
            isPinned={true}
            onPinToggle={() => setPinnedId(null)}
          />
        </div>

        {/* Thumbnail Filmstrip at bottom */}
        <div className="h-28 w-full flex items-center justify-center gap-3 overflow-x-auto pb-1 shrink-0">
          {/* Local User */}
          <div className="w-44 h-full shrink-0">
            <ZoomVideoTile
              name={localUser.name}
              stream={screenStream || localStream}
              isLocal={true}
              isHost={localUser.isHost}
              isAudioOn={isAudioOn}
              isVideoOn={isVideoOn}
              isScreenSharing={isScreenSharing}
              onPinToggle={() => setPinnedId(localUser.id)}
            />
          </div>

          {/* Remote peers */}
          {peerList.map((p) => (
            <div key={p.id} className="w-44 h-full shrink-0">
              <ZoomVideoTile
                name={p.name}
                stream={p.stream}
                isHost={p.isHost}
                isAudioOn={p.isAudioOn}
                isVideoOn={p.isVideoOn}
                isScreenSharing={p.isScreenSharing}
                onPinToggle={() => setPinnedId(p.id)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Gallery Grid View: Full Screen edge-to-edge
  return (
    <div className="absolute inset-0 w-full h-full p-6 pt-20 pb-24 flex items-center justify-center">
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
