/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  MessageSquare, Users, MousePointer, PhoneOff, Share2, Check,
  ChevronUp, ShieldAlert
} from 'lucide-react';
import { useMeetingStore } from '../webrtc/useMeetingStore';
import { webrtcManager } from '../webrtc/WebRtcManager';

export default function ControlsBar({ onStartScreenShare, onStopScreenShare }) {
  const {
    meeting,
    localUser,
    peers,
    activeTab,
    toggleAudio,
    toggleVideo,
    setActiveTab,
    addNotification,
    remoteControl,
    setRemoteControlState
  } = useMeetingStore();

  const [copied, setCopied] = useState(false);
  const [showLeaveMenu, setShowLeaveMenu] = useState(false);

  const participantCount = Object.keys(peers).length + 1;

  const handleAudioToggle = () => {
    toggleAudio();
    webrtcManager.broadcastMediaState();
  };

  const handleVideoToggle = () => {
    toggleVideo();
    webrtcManager.broadcastMediaState();
  };

  const handleScreenToggle = () => {
    if (localUser.screenSharing) {
      onStopScreenShare();
    } else {
      onStartScreenShare();
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}?code=${meeting.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    addNotification('Meeting invite link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLeaveMeeting = () => {
    webrtcManager.disconnect();
    useMeetingStore.getState().resetMeeting();
  };

  const handleEndMeetingForAll = () => {
    if (window.confirm('Are you sure you want to end the meeting for all participants?')) {
      webrtcManager.endMeeting();
    }
  };

  return (
    <div className="relative px-6 py-4 glass-panel border-t border-slate-800/80 flex items-center justify-between z-30 select-none">
      {/* Left: Meeting Code & Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Room:</span>
          <span className="text-sm font-bold tracking-wider text-blue-400 font-mono">{meeting.code}</span>
        </div>

        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-700/70 border border-slate-700/40 text-slate-300 hover:text-white transition text-xs font-medium"
          title="Copy invite link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Invite'}</span>
        </button>
      </div>

      {/* Center: Main Action Controls */}
      <div className="flex items-center gap-3">
        {/* Mic Toggle */}
        <button
          onClick={handleAudioToggle}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all shadow-md ${
            localUser.audioEnabled
              ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
              : 'bg-red-500/90 hover:bg-red-600 text-white shadow-red-500/20'
          }`}
          title={localUser.audioEnabled ? "Mute Microphone" : "Unmute Microphone"}
        >
          {localUser.audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Video Toggle */}
        <button
          onClick={handleVideoToggle}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all shadow-md ${
            localUser.videoEnabled
              ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
              : 'bg-red-500/90 hover:bg-red-600 text-white shadow-red-500/20'
          }`}
          title={localUser.videoEnabled ? "Stop Camera" : "Start Camera"}
        >
          {localUser.videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={handleScreenToggle}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all shadow-md ${
            localUser.screenSharing
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
          }`}
          title={localUser.screenSharing ? "Stop Sharing" : "Share Screen"}
        >
          {localUser.screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        <div className="w-[1px] h-8 bg-slate-700/60 mx-1" />

        {/* Participants Toggle */}
        <button
          onClick={() => setActiveTab('participants')}
          className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all border ${
            activeTab === 'participants'
              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
          title="Participants"
        >
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {participantCount}
          </span>
        </button>

        {/* Chat Toggle */}
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all border ${
            activeTab === 'chat'
              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
          title="Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Right: End / Leave Button */}
      <div className="relative flex items-center gap-3">
        {localUser.isHost ? (
          <div className="relative">
            <div className="flex items-center rounded-2xl overflow-hidden bg-red-600/90 hover:bg-red-600 text-white shadow-lg shadow-red-600/20">
              <button
                onClick={handleLeaveMeeting}
                className="px-4 py-3 text-sm font-semibold flex items-center gap-2 hover:bg-red-700 transition"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Leave</span>
              </button>
              <button
                onClick={() => setShowLeaveMenu(!showLeaveMenu)}
                className="p-3 border-l border-red-500/50 hover:bg-red-700 transition"
                title="Meeting Options"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {showLeaveMenu && (
              <div className="absolute right-0 bottom-16 w-56 rounded-2xl glass-dropdown p-2 z-50 text-sm animate-in fade-in slide-in-from-bottom-2 duration-150">
                <button
                  onClick={() => {
                    setShowLeaveMenu(false);
                    handleEndMeetingForAll();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 font-medium transition"
                >
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>End Meeting for All</span>
                </button>
                <button
                  onClick={() => {
                    setShowLeaveMenu(false);
                    handleLeaveMeeting();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 font-medium transition"
                >
                  <span>Leave Meeting Only</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleLeaveMeeting}
            className="px-5 py-3 rounded-2xl bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-red-600/20 transition"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Leave</span>
          </button>
        )}
      </div>
    </div>
  );
}
