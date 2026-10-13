'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Authentic Zoom Floating Pill Control Dock
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Video, VideoOff, ChevronUp, Users,
  MessageSquare, Smile, Check,
  MonitorUp, Hand, Palette,
  Volume2, Sparkles, RefreshCw, X, Square, Clapperboard, MoreHorizontal
} from 'lucide-react';
import { useMedia } from './MediaProvider';

export default function P2PControls({
  roomCode,
  isHost = false,
  participantCount = 1,
  activePanel,
  onTogglePanel,
  onSendReaction,
  onLeaveMeeting,
  isHandRaised = false,
  onToggleRaiseHand,
  onToggleWhiteboard,
  canUseWhiteboard = false,
  whiteboardActive = false,
  onStartWatchTogether,
  onStopWatchTogether,
  watchTogetherActive = false,
  isMobile = false,
  isMobileLandscape = false
}) {
  const {
    audioEnabled,
    videoEnabled,
    screenSharing,
    devices,
    selectedCam,
    selectedMic,
    selectedSpeaker,
    audioLevel,
    videoFilter = 'none',
    setVideoFilter,
    voiceFocusEnabled,
    toggleAudio,
    toggleVideo,
    toggleVoiceFocus,
    switchCamera,
    switchMicrophone,
    switchAudioOutput,
    testAudioOutput,
    startScreenShare,
    stopScreenShare
  } = useMedia();

  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [videoMenuTab, setVideoMenuTab] = useState('effects'); // 'effects' | 'devices'

  // Ref tracking for outside clicks
  const audioMenuRef = useRef(null);
  const videoMenuRef = useRef(null);
  const reactionsMenuRef = useRef(null);
  const shareMenuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target)) setShowAudioMenu(false);
      if (videoMenuRef.current && !videoMenuRef.current.contains(e.target)) setShowVideoMenu(false);
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target)) setShowShareMenu(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const quickReactions = ['👏', '👍', '❤️', '😂', '😮', '🎉'];

  const filterOptions = [
    { id: 'none', label: 'None', icon: '✨' },
    { id: 'blur', label: 'Blur Background', icon: '🌫️' },
    { id: 'studio', label: 'Executive Studio', icon: '🏢' },
    { id: 'rocket', label: 'Rocket Cockpit', icon: '🚀' },
    { id: 'nature', label: 'Tropical Nature', icon: '🌿' },
    { id: 'moon', label: 'Moon Surface', icon: '🌕' },
    { id: 'astronaut', label: 'Astronaut Helmet', icon: '👨‍🚀' },
    { id: 'cinema', label: 'Cinema Teal & Gold', icon: '🎬' },
    { id: 'warm', label: 'Golden Warmth', icon: '☀️' },
    { id: 'noir', label: 'Noir (B&W)', icon: '🎞️' }
  ];

  return (
    <>
      {/* Floating Pill Dock Container */}
      <footer
        className="meeting-controls fixed sm:absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-[98vw] select-none pointer-events-auto"
      >
        <div className="meeting-controls-dock p2p-dock flex items-center gap-0.5 rounded-lg px-1.5 py-1 sm:gap-0.5 sm:px-2">
          
          {/* 1. MUTE / UNMUTE CAPSULE WITH POPUP CHEVRON */}
          <div ref={audioMenuRef} className="meeting-av-control-group relative flex items-center gap-0 rounded-lg px-0 py-0 transition">
            <button
              type="button"
              onClick={toggleAudio}
              className={`meeting-control-button flex items-center gap-1 py-1 px-1 rounded-xl transition cursor-pointer ${
                !audioEnabled ? 'text-[#FF6B35]' : 'text-[#F8F7FC]'
              }`}
              title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              <div className="relative flex items-center justify-center">
                {audioEnabled ? <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#F8F7FC]" /> : <MicOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#FF6B35]" />}
                {audioEnabled && audioLevel > 15 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF6B35] animate-ping" />
                )}
              </div>
              <span className="meeting-label text-[11px] font-semibold hidden md:inline">
                {audioEnabled ? 'Mute' : 'Unmute'}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAudioMenu(v => !v);
                setShowVideoMenu(false);
              }}
              className="w-4 h-7 text-[#C4B5FD]/70 hover:text-[#F8F7FC] transition flex items-center justify-center cursor-pointer"
              title="Microphone & Speaker Options"
            >
              <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-200 ${showAudioMenu ? 'rotate-180 text-[#FF6B35]' : ''}`} />
            </button>

            {/* Audio Settings Popover - Floats above the pill dock */}
            {showAudioMenu && (
              <div className="absolute bottom-full mb-3 left-0 sm:left-1/2 sm:-translate-x-1/2 w-72 rounded-2xl p2p-dropdown border border-white/10 p-2.5 text-xs shadow-2xl text-[#F8F7FC] z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Select a Microphone</div>
                {devices.audio.length > 0 ? (
                  devices.audio.map(d => (
                    <button
                      key={d.deviceId}
                      onClick={() => { switchMicrophone(d.deviceId); setShowAudioMenu(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                        selectedMic === d.deviceId ? 'bg-[#FF6B35] text-[#0D0B14] font-bold' : 'hover:bg-[rgba(196,181,253,0.10)] text-[#F8F7FC]/80'
                      }`}
                    >
                      <span className="truncate">{d.label || `Microphone ${d.deviceId.slice(0, 4)}`}</span>
                      {selectedMic === d.deviceId && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))
                ) : (
                  <div className="px-2.5 py-1 text-[#C4B5FD]/50 text-xs">Default Microphone</div>
                )}

                <div className="h-[1px] bg-[rgba(196,181,253,0.14)] my-1.5" />

                {/* Voice Focus / Noise Suppression Toggle */}
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Audio Processing</div>
                <button
                  onClick={() => { toggleVoiceFocus?.(); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                    voiceFocusEnabled ? 'bg-[rgba(196,181,253,0.15)] text-[#C4B5FD]' : 'hover:bg-[rgba(196,181,253,0.10)] text-[#F8F7FC]/80'
                  }`}
                  title="Voice Focus uses noise suppression, echo cancellation, and auto gain control"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className={`w-3.5 h-3.5 ${voiceFocusEnabled ? 'text-[#FFA14A]' : 'text-[#C4B5FD]/40'}`} />
                    <span>Voice Focus (Noise Suppression)</span>
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    voiceFocusEnabled ? 'bg-[#FF6B35] text-[#0D0B14]' : 'bg-[rgba(196,181,253,0.10)] text-[#C4B5FD]/60'
                  }`}>
                    {voiceFocusEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                <div className="h-[1px] bg-[rgba(196,181,253,0.14)] my-1.5" />

                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Select a Speaker</div>
                {devices.audioOutput?.length > 0 ? (
                  devices.audioOutput.map(d => (
                    <button
                      key={d.deviceId}
                      onClick={() => { switchAudioOutput(d.deviceId); setShowAudioMenu(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                        selectedSpeaker === d.deviceId ? 'bg-[#FF6B35] text-[#0D0B14] font-bold' : 'hover:bg-[rgba(196,181,253,0.10)] text-[#F8F7FC]/80'
                      }`}
                    >
                      <span className="truncate">{d.label || `Speaker ${d.deviceId.slice(0, 4)}`}</span>
                      {selectedSpeaker === d.deviceId && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))
                ) : (
                  <div className="px-2.5 py-1 text-[#C4B5FD]/50 text-xs">Default Speaker (System)</div>
                )}

                <div className="h-[1px] bg-[rgba(196,181,253,0.14)] my-1.5" />

                <button
                  onClick={() => { testAudioOutput?.(); }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] text-[#FFA14A] font-medium flex items-center gap-2 transition cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Test Speaker & Chime</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. START / STOP VIDEO CAPSULE WITH POPUP CHEVRON */}
          <div ref={videoMenuRef} className="meeting-av-control-group relative flex items-center gap-0 rounded-lg px-0 py-0 transition">
            <button
              type="button"
              onClick={toggleVideo}
              className={`meeting-control-button flex items-center gap-1 py-1 px-1 rounded-xl transition cursor-pointer ${
                !videoEnabled ? 'text-[#FF6B35]' : 'text-[#F8F7FC]'
              }`}
              title={videoEnabled ? 'Stop Video' : 'Start Video'}
            >
              <div className="flex items-center justify-center">
                {videoEnabled ? <Video className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#F8F7FC]" /> : <VideoOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#FF6B35]" />}
              </div>
              <span className="meeting-label text-[11px] font-semibold hidden md:inline">
                {videoEnabled ? 'Stop Video' : 'Start Video'}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoMenu(v => !v);
                setShowAudioMenu(false);
              }}
              className="w-4 h-7 text-[#C4B5FD]/70 hover:text-[#F8F7FC] transition flex items-center justify-center cursor-pointer"
              title="Camera & Virtual Backgrounds"
            >
              <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-200 ${showVideoMenu ? 'rotate-180 text-[#FF6B35]' : ''}`} />
            </button>

            {/* Video Settings Popover - Floats above the pill dock */}
            {showVideoMenu && (
              <div className="absolute bottom-full mb-3 left-0 sm:left-1/2 sm:-translate-x-1/2 w-80 rounded-2xl p2p-dropdown border border-[#FF6B35]/70 p-2.5 text-xs shadow-2xl text-[#F8F7FC] z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl">
                <div className="flex items-center gap-1 bg-[#0D0B14] p-1 rounded-xl mb-2 border border-[rgba(196,181,253,0.12)]">
                  <button
                    onClick={() => setVideoMenuTab('effects')}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      videoMenuTab === 'effects' ? 'bg-[#FF6B35] text-[#0D0B14] font-bold' : 'text-[#C4B5FD]/70 hover:text-[#F8F7FC]'
                    }`}
                  >
                    Virtual Backgrounds
                  </button>
                  <button
                    onClick={() => setVideoMenuTab('devices')}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      videoMenuTab === 'devices' ? 'bg-[#FF6B35] text-[#0D0B14] font-bold' : 'text-[#C4B5FD]/70 hover:text-[#F8F7FC]'
                    }`}
                  >
                    Select Camera
                  </button>
                </div>

                {videoMenuTab === 'devices' ? (
                  <div className="space-y-1">
                    <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Cameras</div>
                    {devices.video.length > 0 ? (
                      devices.video.map(d => (
                        <button
                          key={d.deviceId}
                          onClick={() => { switchCamera(d.deviceId); setShowVideoMenu(false); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                            selectedCam === d.deviceId ? 'bg-[#FF6B35] text-[#0D0B14] font-bold' : 'hover:bg-[rgba(196,181,253,0.10)] text-[#F8F7FC]/80'
                          }`}
                        >
                          <span className="truncate">{d.label || `Camera ${d.deviceId.slice(0, 4)}`}</span>
                          {selectedCam === d.deviceId && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      ))
                    ) : (
                      <div className="px-2.5 py-1 text-[#C4B5FD]/50 text-xs">Default Camera</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Virtual Background & Filters</div>
                    <div className="grid grid-cols-2 gap-1.5 p-1">
                      {filterOptions.map(f => (
                        <button
                          key={f.id}
                          onClick={() => { setVideoFilter(f.id); setShowVideoMenu(false); }}
                          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                            videoFilter === f.id
                              ? 'bg-[rgba(196,181,253,0.18)] border-[#FF6B35] text-[#F8F7FC] font-semibold'
                              : 'bg-[#0D0B14]/60 hover:bg-[#0D0B14] border-[rgba(196,181,253,0.12)] text-[#F8F7FC]/80'
                          }`}
                        >
                          <span className="text-base">{f.icon}</span>
                          <span className="text-[11px] truncate">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-6 w-[1px] bg-[rgba(196,181,253,0.16)] mx-0.5 hidden sm:block shrink-0" />

          {/* 3. CENTER CONTROLS: SECURITY, PARTICIPANTS, CHAT, SHARE SCREEN, WHITEBOARD, RECORD, REACTIONS */}
          
          {/* PARTICIPANTS BUTTON */}
          <button
            type="button"
            onClick={() => onTogglePanel?.('participants')}
            className={`meeting-control-button flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              activePanel === 'participants' ? 'meeting-control-active text-[#FFA14A]' : 'text-white hover:text-[#FFA14A]'
            }`}
            title="Participants List"
          >
            <div className="relative flex items-center justify-center">
              <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="absolute -top-1 -right-2 px-1 rounded-full bg-[#FF6B35] text-[9px] font-bold text-[#0D0B14] leading-tight">
                {participantCount}
              </span>
            </div>
            <span className="meeting-label text-[11px] font-semibold hidden sm:inline ml-1">Participants</span>
          </button>

          {/* CHAT BUTTON */}
          <button
            type="button"
            onClick={() => onTogglePanel?.('chat')}
            className={`meeting-control-button flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              activePanel === 'chat' ? 'meeting-control-active text-[#FFA14A]' : 'text-white hover:text-[#FFA14A]'
            }`}
            title="Meeting Chat"
          >
            <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span className="meeting-label text-[11px] font-semibold hidden sm:inline">Chat</span>
          </button>

          {/* SHARE SCREEN (TRANSLUCENT PILL WITH THIN ACCENT - LESS CONTRASTY & PRESENTATION MENU) */}
          <div ref={shareMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                if (screenSharing) {
                  setShowShareMenu(v => !v);
                  setShowAudioMenu(false);
                  setShowVideoMenu(false);
                } else {
                  startScreenShare({ surface: 'monitor', isWatchParty: false });
                }
              }}
              className={`meeting-control-button flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs transition cursor-pointer ${
                screenSharing
                  ? 'meeting-control-active text-[#FFA14A]'
                  : 'text-[#FFA14A] hover:text-[#F8F7FC]'
              }`}
              title={screenSharing ? 'Presentation Options (Click to switch or stop)' : 'Share Screen'}
            >
              <MonitorUp className="w-4 h-4 shrink-0 text-[#FF6B35]" />
              <span className="meeting-label text-[11px] font-semibold tracking-tight">
                {screenSharing ? 'Stop Share' : 'Share Screen'}
              </span>
              {screenSharing && (
                <ChevronUp className={`w-3 h-3 text-[#FFA14A] transition-transform duration-200 ${showShareMenu ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* PRESENTATION OPTIONS POPUP MENU */}
            {screenSharing && showShareMenu && (
              <div
                className="absolute bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 w-64 sm:w-72 rounded-2xl bg-[#161324]/95 border border-[#FF6B35]/60 p-2 text-xs shadow-2xl backdrop-blur-2xl z-50 text-[#F8F7FC] animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B35] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF6B35]"></span>
                    </span>
                    <span className="text-[11px] font-bold text-[#FFA14A] uppercase tracking-wider">Presenting Screen</span>
                  </div>
                  <button
                    onClick={() => setShowShareMenu(false)}
                    className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  {/* Option 1: Share Something Else / Switch Window */}
                  <button
                    onClick={() => {
                      setShowShareMenu(false);
                      startScreenShare({ surface: 'monitor', isWatchParty: false });
                    }}
                    className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.08] transition text-left cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-[#FF6B35]/20 text-[#FFA14A] group-hover:bg-[#FF6B35] group-hover:text-[#0D0B14] transition shrink-0 mt-0.5">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#F8F7FC] group-hover:text-[#FFA14A] transition">Share Something Else</div>
                      <div className="text-[10px] text-white/60 leading-tight">Switch to another screen, window, or tab</div>
                    </div>
                  </button>

                  <div className="h-[1px] bg-white/10 my-0.5" />

                  {/* Option 4: Stop Sharing Screen */}
                  <button
                    onClick={() => {
                      setShowShareMenu(false);
                      stopScreenShare();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 border border-[#FF6B35]/50 text-[#FFA14A] hover:text-[#F8F7FC] transition cursor-pointer font-semibold text-xs mt-0.5"
                  >
                    <span className="flex items-center gap-2">
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop Sharing
                    </span>
                    <span className="text-[10px] opacity-75">End Presentation</span>
                  </button>

                  {/* Option 5: Cancel */}
                  <button
                    onClick={() => setShowShareMenu(false)}
                    className="w-full text-center py-1 text-[11px] text-white/50 hover:text-white transition cursor-pointer"
                  >
                    Cancel (Keep Sharing)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* WHITEBOARD BUTTON */}
          {canUseWhiteboard && <button
            type="button"
            onClick={onToggleWhiteboard}
            className={`meeting-control-button meeting-control-whiteboard flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              whiteboardActive ? 'meeting-control-active text-[#FFA14A]' : 'text-white hover:text-[#FFA14A]'
            }`}
            title="Open Interactive Whiteboard"
          >
            <Palette className="w-4 h-4" />
            <span className="meeting-label hidden md:inline text-[11px] font-semibold">Whiteboard</span>
          </button>}

          {/* REACTIONS & RAISE HAND */}
          <div ref={reactionsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowReactionsMenu(v => !v);
                setShowAudioMenu(false);
                setShowVideoMenu(false);
              }}
              className={`meeting-control-button meeting-control-reactions flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                isHandRaised ? 'meeting-control-active text-[#FFA14A]' : 'text-white hover:text-[#FFA14A]'
              }`}
              title="Send Reactions & Raise Hand"
            >
              {isHandRaised ? <Hand className="w-4 h-4 text-[#FFA14A] animate-bounce" /> : <Smile className="w-4 h-4 text-[#FF6B35]" />}
              <span className="meeting-label text-[11px] font-semibold hidden sm:inline">
                {isHandRaised ? 'Raised' : 'React'}
              </span>
            </button>

            {/* Reactions Popover - Floats above the pill dock */}
            {showReactionsMenu && (
              <div className="absolute bottom-full mb-3 right-0 sm:left-1/2 sm:-translate-x-1/2 w-64 rounded-2xl p2p-dropdown border border-white/20 p-3 text-xs shadow-2xl text-[#F8F7FC] z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(196,181,253,0.14)] mb-2.5">
                  {quickReactions.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onSendReaction?.(emoji);
                      }}
                      className="text-xl p-1 rounded-xl hover:bg-white/15 hover:scale-125 transition transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    onToggleRaiseHand?.();
                  }}
                  className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition shadow cursor-pointer ${
                    isHandRaised
                      ? 'bg-[#FF6B35] text-[#0D0B14]'
                      : 'bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FFA14A] border border-[#FF6B35]/40'
                  }`}
                >
                  <Hand className="w-4 h-4" />
                  <span>{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Desktop hand raise is a direct action; mobile keeps it in More. */}
          <button
            type="button"
            onClick={onToggleRaiseHand}
            aria-pressed={isHandRaised}
            className={`meeting-control-button meeting-control-desktop-hand hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
              isHandRaised ? 'meeting-control-active text-[#FFA14A]' : 'text-white hover:text-[#FFA14A]'
            }`}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className={`h-4 w-4 ${isHandRaised ? 'text-[#FFA14A]' : ''}`} />
            <span className="meeting-label text-[11px] font-semibold">{isHandRaised ? 'Lower hand' : 'Raise hand'}</span>
          </button>

          {/* Mobile overflow menu: secondary actions live in the expanding glass dock. */}
          <button
            type="button"
            onClick={() => setShowMoreMenu(value => !value)}
            aria-expanded={showMoreMenu}
            aria-label={showMoreMenu ? 'Close more meeting controls' : 'More meeting controls'}
            className="meeting-control-button meeting-mobile-more hidden items-center justify-center rounded-xl text-white/90 transition hover:text-[#FFA14A]"
            title="More meeting controls"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {/* Divider */}
          <div className="h-6 w-[1px] bg-white/20 mx-0.5 hidden sm:block shrink-0" />

          {/* 4. LEAVE / END BUTTON (TRANSLUCENT CRIMSON PILL) */}
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="meeting-control-button meeting-end-button px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/35 border border-red-400/25 text-red-100 hover:text-white font-semibold text-xs transition cursor-pointer shrink-0"
          >
            {isHost ? 'End' : 'Leave'}
          </button>
        </div>

        {showMoreMenu && (
          <section className="mobile-more-sheet liquid-glass-panel" aria-label="More meeting controls">
            <div className="mobile-more-heading">
              <div>
                <p className="text-sm font-semibold text-white">More controls</p>
                <p className="text-[11px] text-white/55">Meeting tools and device options</p>
              </div>
              <button type="button" onClick={() => setShowMoreMenu(false)} aria-label="Close menu" className="mobile-more-close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mobile-more-actions">
              <button type="button" onClick={() => { onToggleRaiseHand?.(); setShowMoreMenu(false); }} className={`mobile-more-action ${isHandRaised ? 'is-active' : ''}`}>
                <Hand className="h-4 w-4" /><span>{isHandRaised ? 'Lower hand' : 'Raise hand'}</span>
              </button>
              {canUseWhiteboard && onToggleWhiteboard && (
                <button type="button" onClick={() => { onToggleWhiteboard(); setShowMoreMenu(false); }} className={`mobile-more-action ${whiteboardActive ? 'is-active' : ''}`}>
                  <Palette className="h-4 w-4" /><span>{whiteboardActive ? 'Close whiteboard' : 'Whiteboard'}</span>
                </button>
              )}
              <button type="button" onClick={() => toggleVoiceFocus?.()} className={`mobile-more-action ${voiceFocusEnabled ? 'is-active' : ''}`}>
                <Sparkles className="h-4 w-4" /><span>Voice focus {voiceFocusEnabled ? 'on' : 'off'}</span>
              </button>
              {screenSharing && (
                <button type="button" onClick={() => { stopScreenShare(); setShowMoreMenu(false); }} className="mobile-more-action is-danger">
                  <Square className="h-4 w-4" /><span>Stop sharing</span>
                </button>
              )}
            </div>

            <div className="mobile-more-section">
              <p className="mobile-more-label">Send a reaction</p>
              <div className="mobile-more-reactions">
                {quickReactions.map(emoji => (
                  <button type="button" key={emoji} onClick={() => { onSendReaction?.(emoji); setShowMoreMenu(false); }} aria-label={`Send ${emoji} reaction`}>{emoji}</button>
                ))}
              </div>
            </div>

            <div className="mobile-more-devices">
              <label>
                <span>Microphone</span>
                <select value={selectedMic || ''} onChange={event => switchMicrophone(event.target.value)}>
                  {devices.audio.length === 0 && <option value="">Default microphone</option>}
                  {devices.audio.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>)}
                </select>
              </label>
              <label>
                <span>Camera</span>
                <select value={selectedCam || ''} onChange={event => switchCamera(event.target.value)}>
                  {devices.video.length === 0 && <option value="">Default camera</option>}
                  {devices.video.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>)}
                </select>
              </label>
            </div>

            <div className="mobile-more-section mobile-more-effects">
              <p className="mobile-more-label">Camera effect</p>
              <div className="mobile-more-effect-list">
                {filterOptions.map(effect => (
                  <button type="button" key={effect.id} onClick={() => setVideoFilter(effect.id)} className={videoFilter === effect.id ? 'is-active' : ''}>
                    <span>{effect.icon}</span>{effect.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </footer>

      {/* Leave Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-[#0D0B14]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#161324] border border-[rgba(196,181,253,0.20)] p-5 text-[#F8F7FC] shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-[#F8F7FC] mb-2">
              {isHost ? 'End Meeting for All?' : 'Leave Meeting?'}
            </h3>
            <p className="text-xs text-[#C4B5FD]/70 mb-5">
              {isHost
                ? 'You are the host. Leaving will end the meeting for everyone.'
                : 'Are you sure you want to leave this call? You can rejoin anytime using the room code.'}
            </p>

            <div className="flex flex-col gap-2">
              {isHost && (
                <button
                  onClick={() => {
                    setShowLeaveModal(false);
                    onLeaveMeeting?.(true); // true = end for all
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#FF6B35] hover:brightness-110 text-[#0D0B14] font-bold text-xs transition shadow-lg shadow-[#FF6B35]/25 cursor-pointer"
                >
                  End Meeting for All
                </button>
              )}

              {!isHost && (
                <button
                  onClick={() => {
                    setShowLeaveModal(false);
                    onLeaveMeeting?.(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#FFA14A] text-[#0D0B14] font-bold text-xs transition shadow-md shadow-[#FF6B35]/20 cursor-pointer"
                >
                  Leave Meeting
                </button>
              )}

              <button
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-2 text-[#C4B5FD]/50 hover:text-[#F8F7FC] text-xs transition mt-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
