'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, ChevronUp, Shield, Users,
  MessageSquare, Share2, Smile, PhoneOff, Settings, Check,
  Sparkles, Lock, ArrowUpRight
} from 'lucide-react';
import { useMedia } from './MediaProvider';

export default function ZoomControls({
  roomCode,
  isHost,
  participantCount,
  activePanel,
  onTogglePanel,
  onSendReaction,
  onLeaveMeeting,
  onStartWatchTogether,
  onStopWatchTogether,
  watchTogetherActive
}) {
  const {
    audioEnabled,
    videoEnabled,
    screenSharing,
    devices,
    selectedCam,
    selectedMic,
    audioLevel,
    toggleAudio,
    toggleVideo,
    switchCamera,
    switchMicrophone,
    startScreenShare,
    stopScreenShare
  } = useMedia();

  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [showSecurityMenu, setShowSecurityMenu] = useState(false);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const reactions = [
    { emoji: '👏', name: 'Clap' },
    { emoji: '👍', name: 'Thumbs Up' },
    { emoji: '❤️', name: 'Heart' },
    { emoji: '😂', name: 'Joy' },
    { emoji: '😮', name: 'Surprised' },
    { emoji: '🎉', name: 'Party' },
  ];

  const handleCopyInvite = () => {
    const url = `${window.location.origin}?code=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 select-none">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-3xl zoom-dock">
        {/* 1. MUTE / AUDIO */}
        <div className="relative flex items-center">
          <button
            onClick={toggleAudio}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${
              audioEnabled
                ? 'hover:bg-white/10 text-slate-100'
                : 'bg-red-500/90 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
            }`}
            title={audioEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {audioEnabled ? (
              <div className="relative">
                <Mic className="w-5 h-5 text-slate-100" />
                {audioLevel > 15 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
            ) : (
              <MicOff className="w-5 h-5" />
            )}
            <span className="text-[10px] font-semibold mt-0.5">{audioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>

          <button
            onClick={() => setShowAudioMenu(!showAudioMenu)}
            className="p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Audio Settings"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Audio Device Dropdown */}
          {showAudioMenu && (
            <div className="absolute bottom-16 left-0 w-64 rounded-2xl zoom-dropdown p-3 text-xs text-slate-300 z-50 animate-in fade-in slide-in-from-bottom-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 block mb-1">
                Select Microphone
              </span>
              {devices.audio.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => { switchMicrophone(d.deviceId); setShowAudioMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                    selectedMic === d.deviceId ? 'bg-blue-600 text-white' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{d.label || `Microphone ${d.deviceId.substring(0, 5)}`}</span>
                  {selectedMic === d.deviceId && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. VIDEO / CAMERA */}
        <div className="relative flex items-center">
          <button
            onClick={toggleVideo}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${
              videoEnabled
                ? 'hover:bg-white/10 text-slate-100'
                : 'bg-red-500/90 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
            }`}
            title={videoEnabled ? "Stop Camera" : "Start Camera"}
          >
            {videoEnabled ? <Video className="w-5 h-5 text-slate-100" /> : <VideoOff className="w-5 h-5" />}
            <span className="text-[10px] font-semibold mt-0.5">{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
          </button>

          <button
            onClick={() => setShowVideoMenu(!showVideoMenu)}
            className="p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Video Settings"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Video Device Dropdown */}
          {showVideoMenu && (
            <div className="absolute bottom-16 left-0 w-64 rounded-2xl zoom-dropdown p-3 text-xs text-slate-300 z-50 animate-in fade-in slide-in-from-bottom-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 block mb-1">
                Select Camera
              </span>
              {devices.video.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => { switchCamera(d.deviceId); setShowVideoMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                    selectedCam === d.deviceId ? 'bg-blue-600 text-white' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{d.label || `Camera ${d.deviceId.substring(0, 5)}`}</span>
                  {selectedCam === d.deviceId && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-[1px] h-7 bg-white/10 mx-1" />

        {/* 3. SECURITY */}
        <div className="relative">
          <button
            onClick={() => setShowSecurityMenu(!showSecurityMenu)}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl hover:bg-white/10 text-slate-200 transition"
            title="Security Settings"
          >
            <Shield className="w-5 h-5 text-slate-200" />
            <span className="text-[10px] font-semibold mt-0.5">Security</span>
          </button>

          {showSecurityMenu && (
            <div className="absolute bottom-16 left-0 w-56 rounded-2xl zoom-dropdown p-3 text-xs text-slate-200 z-50 space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                <Lock className="w-4 h-4 shrink-0" />
                <span>P2P Direct Encrypted</span>
              </div>
              <button
                onClick={handleCopyInvite}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 flex items-center justify-between transition"
              >
                <span>Copy Invite Link</span>
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* 4. PARTICIPANTS */}
        <button
          onClick={() => onTogglePanel('participants')}
          className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition ${
            activePanel === 'participants' ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'hover:bg-white/10 text-slate-200'
          }`}
          title="Participants"
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Participants</span>
          <span className="absolute 1 top-1 right-1 px-1.5 py-0.2 rounded-full bg-blue-600 text-[9px] font-black text-white">
            {participantCount}
          </span>
        </button>

        {/* 5. CHAT */}
        <button
          onClick={() => onTogglePanel('chat')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition ${
            activePanel === 'chat' ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'hover:bg-white/10 text-slate-200'
          }`}
          title="Chat"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Chat</span>
        </button>

        {/* 6. SIGNATURE ZOOM BRIGHT GREEN "SHARE SCREEN" */}
        <button
          onClick={screenSharing ? stopScreenShare : startScreenShare}
          className={`flex flex-col items-center justify-center px-3 h-12 rounded-2xl transition-all shadow-md ${
            screenSharing
              ? 'bg-red-500/90 hover:bg-red-600 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
          }`}
          title={screenSharing ? "Stop Sharing" : "Share Screen"}
        >
          <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
          <span className="text-[10px] font-bold mt-0.5">{screenSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>

        {/* 6b. WATCH TOGETHER (CO-STREAMING) */}
        <div className="relative">
          <button
            onClick={() => {
              if (watchTogetherActive) {
                onStopWatchTogether?.();
              } else {
                setShowWatchModal(!showWatchModal);
              }
            }}
            className={`flex flex-col items-center justify-center px-3 h-12 rounded-2xl transition ${
              watchTogetherActive
                ? 'bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'hover:bg-white/10 text-slate-200'
            }`}
            title="Watch Together (Co-streaming)"
          >
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="text-[10px] font-semibold mt-0.5">
              {watchTogetherActive ? 'End Watch' : 'Watch Party'}
            </span>
          </button>

          {showWatchModal && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-80 rounded-2xl zoom-dropdown p-4 text-xs text-slate-200 z-50 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Co-Streaming Watch Party
                </span>
                <button
                  onClick={() => setShowWatchModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Quick Play Presets</span>
                <button
                  onClick={() => {
                    onStartWatchTogether?.("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
                    setShowWatchModal(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-slate-200 font-medium"
                >
                  🎬 Big Buck Bunny (HD Animation)
                </button>
                <button
                  onClick={() => {
                    onStartWatchTogether?.("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4");
                    setShowWatchModal(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-slate-200 font-medium"
                >
                  🚀 Tears of Steel (HD Sci-Fi)
                </button>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-white/10">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Or Custom Video URL</span>
                <input
                  type="text"
                  placeholder="https://.../video.mp4"
                  value={customVideoUrl}
                  onChange={(e) => setCustomVideoUrl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => {
                    if (customVideoUrl.trim()) {
                      onStartWatchTogether?.(customVideoUrl.trim());
                      setShowWatchModal(false);
                    }
                  }}
                  className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow"
                >
                  Start Synced Playback
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 7. REACTIONS */}
        <div className="relative">
          <button
            onClick={() => setShowReactionsMenu(!showReactionsMenu)}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl hover:bg-white/10 text-slate-200 transition"
            title="Reactions"
          >
            <Smile className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] font-semibold mt-0.5">Reactions</span>
          </button>

          {showReactionsMenu && (
            <div className="absolute bottom-16 right-0 rounded-2xl zoom-dropdown p-2 flex items-center gap-1.5 z-50 animate-in fade-in zoom-in-95">
              {reactions.map((r) => (
                <button
                  key={r.name}
                  onClick={() => {
                    onSendReaction(r.emoji);
                    setShowReactionsMenu(false);
                  }}
                  className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-xl hover:scale-125 transition duration-150"
                  title={r.name}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-[1px] h-7 bg-white/10 mx-1" />

        {/* 8. ZOOM SIGNATURE RED END / LEAVE BUTTON */}
        <button
          onClick={onLeaveMeeting}
          className="px-4 h-11 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition duration-150 ml-1"
        >
          <PhoneOff className="w-4 h-4" />
          <span>{isHost ? 'End' : 'Leave'}</span>
        </button>
      </div>
    </div>
  );
}
