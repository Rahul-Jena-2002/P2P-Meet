/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect } from 'react';
import {
  Grid, Maximize, Minimize, ShieldCheck, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import { useMeetingStore } from '../webrtc/useMeetingStore';
import { webrtcManager } from '../webrtc/WebRtcManager';
import VideoTile from './VideoTile';
import ControlsBar from './ControlsBar';
import ChatDrawer from '../chat/ChatDrawer';
import ParticipantsDrawer from '../participants/ParticipantsDrawer';

export default function MeetingRoom() {
  const {
    meeting,
    localUser,
    localStream,
    screenStream,
    peers,
    activeTab,
    pinnedPeerId,
    activeSpeakerId,
    notifications,
    setScreenStream,
    setScreenSharing,
    setActiveTab,
    setPinnedPeerId,
    addNotification
  } = useMeetingStore();

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Screen sharing logic
  const handleStartScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
      const screenTrack = stream.getVideoTracks()[0];

      setScreenStream(stream);
      setScreenSharing(true);
      webrtcManager.replaceVideoTrack(screenTrack);
      webrtcManager.broadcastMediaState();
      addNotification('You started sharing your screen', 'info');

      // Listen for browser native "Stop Sharing" button
      screenTrack.onended = () => {
        handleStopScreenShare();
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('Failed to share screen:', err);
        addNotification('Could not start screen sharing', 'error');
      }
    }
  };

  const handleStopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    setScreenStream(null);
    setScreenSharing(false);

    // Revert to camera track if camera was enabled
    const cameraTrack = localStream?.getVideoTracks()[0] || null;
    webrtcManager.replaceVideoTrack(cameraTrack);
    webrtcManager.broadcastMediaState();
    addNotification('You stopped sharing your screen', 'info');
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

  const allPeersList = Object.values(peers);
  const totalTiles = 1 + allPeersList.length;

  // Active or pinned tile for stage layout
  const pinnedTile = pinnedPeerId
    ? (pinnedPeerId === localUser.participantId
        ? { isLocal: true, stream: screenStream || localStream, user: localUser }
        : { isLocal: false, stream: peers[pinnedPeerId]?.stream, user: peers[pinnedPeerId] })
    : null;

  return (
    <div className="flex flex-col h-screen w-screen bg-dark-900 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header Bar */}
      <header className="px-6 py-3.5 glass-panel border-b border-slate-800/80 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            OM
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-wide">{meeting.title || 'OpenMeet'}</h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>P2P Encrypted Mesh</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pinnedPeerId && (
            <button
              onClick={() => setPinnedPeerId(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-blue-400 font-medium border border-slate-700 transition"
            >
              Reset to Grid
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Video Arena & Side Drawers */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Canvas */}
        <main className="flex-1 p-4 flex flex-col items-center justify-center overflow-hidden">
          {pinnedTile ? (
            /* Stage Presentation View (when a tile is pinned or presentation active) */
            <div className="flex flex-col w-full h-full gap-4">
              <div className="flex-1 w-full h-full min-h-0">
                <VideoTile
                  participantId={pinnedTile.isLocal ? localUser.participantId : pinnedTile.user.participantId}
                  displayName={pinnedTile.isLocal ? localUser.displayName : pinnedTile.user.displayName}
                  stream={pinnedTile.stream}
                  isLocal={pinnedTile.isLocal}
                  isHost={pinnedTile.isLocal ? localUser.isHost : pinnedTile.user.role === 'HOST'}
                  audioEnabled={pinnedTile.isLocal ? localUser.audioEnabled : pinnedTile.user.audioEnabled}
                  videoEnabled={pinnedTile.isLocal ? localUser.videoEnabled : pinnedTile.user.videoEnabled}
                  screenSharing={pinnedTile.isLocal ? localUser.screenSharing : pinnedTile.user.screenSharing}
                  isPinned={true}
                  onPinToggle={() => setPinnedPeerId(null)}
                />
              </div>

              {/* Thumbnails row at bottom */}
              <div className="h-28 flex items-center justify-center gap-3 overflow-x-auto pb-1 shrink-0">
                {/* Local user tile */}
                <div className="w-44 h-full shrink-0">
                  <VideoTile
                    participantId={localUser.participantId}
                    displayName={localUser.displayName}
                    stream={screenStream || localStream}
                    isLocal={true}
                    isHost={localUser.isHost}
                    audioEnabled={localUser.audioEnabled}
                    videoEnabled={localUser.videoEnabled}
                    screenSharing={localUser.screenSharing}
                    onPinToggle={setPinnedPeerId}
                  />
                </div>
                {/* Remote peers */}
                {allPeersList.map(peer => (
                  <div key={peer.participantId} className="w-44 h-full shrink-0">
                    <VideoTile
                      participantId={peer.participantId}
                      displayName={peer.displayName}
                      stream={peer.stream}
                      isHost={peer.role === 'HOST'}
                      audioEnabled={peer.audioEnabled}
                      videoEnabled={peer.videoEnabled}
                      screenSharing={peer.screenSharing}
                      onPinToggle={setPinnedPeerId}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Responsive Gallery Grid View */
            <div
              className={`w-full h-full grid gap-4 p-2 transition-all duration-300 ${
                totalTiles === 1
                  ? 'grid-cols-1 max-w-4xl max-h-[78vh]'
                  : totalTiles === 2
                  ? 'grid-cols-1 md:grid-cols-2 max-w-6xl max-h-[78vh]'
                  : totalTiles <= 4
                  ? 'grid-cols-2 max-w-6xl max-h-[80vh]'
                  : 'grid-cols-2 lg:grid-cols-3 max-w-7xl max-h-[82vh]'
              }`}
            >
              {/* Local Participant Tile */}
              <VideoTile
                participantId={localUser.participantId}
                displayName={localUser.displayName}
                stream={screenStream || localStream}
                isLocal={true}
                isHost={localUser.isHost}
                audioEnabled={localUser.audioEnabled}
                videoEnabled={localUser.videoEnabled}
                screenSharing={localUser.screenSharing}
                isActiveSpeaker={activeSpeakerId === localUser.participantId}
                onPinToggle={setPinnedPeerId}
              />

              {/* Remote Participants Tiles */}
              {allPeersList.map((peer) => (
                <VideoTile
                  key={peer.participantId}
                  participantId={peer.participantId}
                  displayName={peer.displayName}
                  stream={peer.stream}
                  isHost={peer.role === 'HOST'}
                  audioEnabled={peer.audioEnabled}
                  videoEnabled={peer.videoEnabled}
                  screenSharing={peer.screenSharing}
                  isActiveSpeaker={activeSpeakerId === peer.participantId}
                  onPinToggle={setPinnedPeerId}
                />
              ))}
            </div>
          )}
        </main>

        {/* Slide-out Drawers */}
        {activeTab === 'chat' && <ChatDrawer onClose={() => setActiveTab(null)} />}
        {activeTab === 'participants' && <ParticipantsDrawer onClose={() => setActiveTab(null)} />}
      </div>

      {/* Bottom Floating Control Bar */}
      <ControlsBar
        onStartScreenShare={handleStartScreenShare}
        onStopScreenShare={handleStopScreenShare}
      />

      {/* Floating Toast Notifications */}
      <div className="fixed bottom-24 left-6 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/90 text-white text-sm font-medium border border-slate-700/80 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-200"
          >
            {n.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
            {n.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400" />}
            {n.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {n.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
            <span>{n.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
