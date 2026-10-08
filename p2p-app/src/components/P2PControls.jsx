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
  MessageSquare, Smile, Check, Shield,
  Share2, Circle, Hand, Palette,
  Volume2, Sparkles, Lock
} from 'lucide-react';
import { useMedia } from './MediaProvider';
import { soundSynth } from '../lib/soundEffects';

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
  isRecording = false,
  onToggleRecording,
  onToggleWhiteboard,
  whiteboardActive = false,
  securitySettings = { lockMeeting: false, allowScreenShare: true, allowChat: true, allowRename: true, allowUnmute: true },
  onUpdateSecurity,
  onStartWatchTogether,
  onStopWatchTogether,
  watchTogetherActive = false,
  isVisible = true,
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
  const [showSecurityMenu, setShowSecurityMenu] = useState(false);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [videoMenuTab, setVideoMenuTab] = useState('effects'); // 'effects' | 'devices'

  // Ref tracking for outside clicks
  const audioMenuRef = useRef(null);
  const videoMenuRef = useRef(null);
  const securityMenuRef = useRef(null);
  const reactionsMenuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target)) setShowAudioMenu(false);
      if (videoMenuRef.current && !videoMenuRef.current.contains(e.target)) setShowVideoMenu(false);
      if (securityMenuRef.current && !securityMenuRef.current.contains(e.target)) setShowSecurityMenu(false);
      if (reactionsMenuRef.current && !reactionsMenuRef.current.contains(e.target)) setShowReactionsMenu(false);
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

  const isAnyMenuOpen = showAudioMenu || showVideoMenu || showSecurityMenu || showReactionsMenu;

  return (
    <>
      {/* Floating Pill Dock Container */}
      <footer
        className={`fixed sm:absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[98vw] select-none transition-all duration-300 pointer-events-auto ${
          isVisible || isAnyMenuOpen
            ? 'translate-y-0 opacity-100'
            : 'translate-y-12 opacity-0 pointer-events-none'
        }`}
      >
        <div className="p2p-dock rounded-full px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 shadow-2xl shadow-black/90 border border-[#FF6B35]/70 backdrop-blur-2xl">
          
          {/* 1. MUTE / UNMUTE CAPSULE WITH POPUP CHEVRON */}
          <div ref={audioMenuRef} className="relative flex items-center bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 rounded-full pl-2 pr-1 py-0.5 border border-[#FF6B35]/70 backdrop-blur-xl transition">
            <button
              type="button"
              onClick={toggleAudio}
              className={`flex items-center gap-1.5 py-1 px-1.5 rounded-full transition cursor-pointer ${
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
              <span className="text-[11px] font-semibold hidden md:inline">
                {audioEnabled ? 'Mute' : 'Unmute'}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAudioMenu(v => !v);
                setShowVideoMenu(false);
                setShowSecurityMenu(false);
                setShowReactionsMenu(false);
              }}
              className="w-6 h-7 rounded-full text-[#C4B5FD]/70 hover:text-[#F8F7FC] hover:bg-white/10 transition flex items-center justify-center cursor-pointer ml-0.5"
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
                        selectedMic === d.deviceId ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold' : 'hover:bg-[rgba(196,181,253,0.10)] text-[#F8F7FC]/80'
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
                        selectedSpeaker === d.deviceId ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold' : 'hover:bg-[rgba(196,181,253,0.10)] text-[#F8F7FC]/80'
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
          <div ref={videoMenuRef} className="relative flex items-center bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 rounded-full pl-2 pr-1 py-0.5 border border-[#FF6B35]/70 backdrop-blur-xl transition">
            <button
              type="button"
              onClick={toggleVideo}
              className={`flex items-center gap-1.5 py-1 px-1.5 rounded-full transition cursor-pointer ${
                !videoEnabled ? 'text-[#FF6B35]' : 'text-[#F8F7FC]'
              }`}
              title={videoEnabled ? 'Stop Video' : 'Start Video'}
            >
              <div className="flex items-center justify-center">
                {videoEnabled ? <Video className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#F8F7FC]" /> : <VideoOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#FF6B35]" />}
              </div>
              <span className="text-[11px] font-semibold hidden md:inline">
                {videoEnabled ? 'Stop Video' : 'Start Video'}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoMenu(v => !v);
                setShowAudioMenu(false);
                setShowSecurityMenu(false);
                setShowReactionsMenu(false);
              }}
              className="w-6 h-7 rounded-full text-[#C4B5FD]/70 hover:text-[#F8F7FC] hover:bg-white/10 transition flex items-center justify-center cursor-pointer ml-0.5"
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
                      videoMenuTab === 'effects' ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold' : 'text-[#C4B5FD]/70 hover:text-[#F8F7FC]'
                    }`}
                  >
                    Virtual Backgrounds
                  </button>
                  <button
                    onClick={() => setVideoMenuTab('devices')}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      videoMenuTab === 'devices' ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold' : 'text-[#C4B5FD]/70 hover:text-[#F8F7FC]'
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
                            selectedCam === d.deviceId ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold' : 'hover:bg-[rgba(196,181,253,0.10)] text-[#F8F7FC]/80'
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
          
          {/* SECURITY MENU (Host only) */}
          {isHost && (
            <div ref={securityMenuRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setShowSecurityMenu(v => !v);
                  setShowAudioMenu(false);
                  setShowVideoMenu(false);
                  setShowReactionsMenu(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FF6B35]/70 transition cursor-pointer ${
                  showSecurityMenu ? 'bg-[#FF6B35] text-[#0D0B14]' : 'bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 text-[#F8F7FC]'
                }`}
                title="Security Options"
              >
                <Shield className="w-4 h-4 text-[#FF6B35]" />
                <span className="text-[11px] font-semibold hidden lg:inline">Security</span>
              </button>

              {showSecurityMenu && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 rounded-2xl p2p-dropdown border border-[#FF6B35]/70 p-2.5 text-xs shadow-2xl text-[#F8F7FC] z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Lock & Access</div>
                  <button
                    onClick={() => onUpdateSecurity?.({ lockMeeting: !securitySettings.lockMeeting })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <span>Lock Meeting</span>
                    {securitySettings.lockMeeting ? <Check className="w-3.5 h-3.5 text-[#FF6B35]" /> : <Lock className="w-3 h-3 text-[#C4B5FD]/40" />}
                  </button>

                  <div className="h-[1px] bg-[rgba(196,181,253,0.14)] my-1.5" />

                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Allow Participants to:</div>
                  <button
                    onClick={() => onUpdateSecurity?.({ allowScreenShare: !securitySettings.allowScreenShare })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <span>Share Screen</span>
                    {securitySettings.allowScreenShare && <Check className="w-3.5 h-3.5 text-[#FF6B35]" />}
                  </button>

                  <button
                    onClick={() => onUpdateSecurity?.({ allowChat: !securitySettings.allowChat })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <span>Chat</span>
                    {securitySettings.allowChat && <Check className="w-3.5 h-3.5 text-[#FF6B35]" />}
                  </button>

                  <button
                    onClick={() => onUpdateSecurity?.({ allowRename: !securitySettings.allowRename })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <span>Rename Themselves</span>
                    {securitySettings.allowRename && <Check className="w-3.5 h-3.5 text-[#FF6B35]" />}
                  </button>

                  <button
                    onClick={() => onUpdateSecurity?.({ allowUnmute: !securitySettings.allowUnmute })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <span>Unmute Themselves</span>
                    {securitySettings.allowUnmute && <Check className="w-3.5 h-3.5 text-[#FF6B35]" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PARTICIPANTS BUTTON */}
          <button
            type="button"
            onClick={() => onTogglePanel?.('participants')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FF6B35]/70 transition cursor-pointer ${
              activePanel === 'participants' ? 'bg-[#FF6B35] text-[#0D0B14]' : 'bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 text-[#F8F7FC]'
            }`}
            title="Participants List"
          >
            <div className="relative flex items-center justify-center">
              <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="absolute -top-1 -right-2 px-1 rounded-full bg-[#FF6B35] text-[9px] font-bold text-[#0D0B14] leading-tight">
                {participantCount}
              </span>
            </div>
            <span className="text-[11px] font-semibold hidden sm:inline ml-1">Participants</span>
          </button>

          {/* CHAT BUTTON */}
          <button
            type="button"
            onClick={() => onTogglePanel?.('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FF6B35]/70 transition cursor-pointer ${
              activePanel === 'chat' ? 'bg-[#FF6B35] text-[#0D0B14]' : 'bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 text-[#F8F7FC]'
            }`}
            title="Meeting Chat"
          >
            <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span className="text-[11px] font-semibold hidden sm:inline">Chat</span>
          </button>

          {/* SHARE SCREEN (TRANSLUCENT PILL WITH THIN ORANGE BORDER - LESS CONTRASTY) */}
          <button
            type="button"
            onClick={() => {
              if (screenSharing) {
                stopScreenShare();
              } else {
                startScreenShare({ surface: 'monitor', isWatchParty: false });
              }
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs border border-[#FF6B35]/70 transition cursor-pointer ${
              screenSharing
                ? 'bg-[#FF6B35]/25 hover:bg-[#FF6B35]/35 text-[#FFA14A]'
                : 'bg-[#0D0B14]/50 hover:bg-[#FF6B35]/20 text-[#FFA14A] hover:text-[#F8F7FC]'
            }`}
            title={screenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <Share2 className="w-4 h-4 shrink-0 text-[#FF6B35]" />
            <span className="text-[11px] font-semibold tracking-tight">
              {screenSharing ? 'Stop Share' : 'Share Screen'}
            </span>
          </button>

          {/* WHITEBOARD BUTTON */}
          <button
            type="button"
            onClick={onToggleWhiteboard}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FF6B35]/70 transition cursor-pointer ${
              whiteboardActive ? 'bg-[#FF6B35] text-[#0D0B14]' : 'bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 text-[#F8F7FC]'
            }`}
            title="Open Interactive Whiteboard"
          >
            <Palette className="w-4 h-4" />
            <span className="text-[11px] font-semibold">Whiteboard</span>
          </button>

          {/* RECORD BUTTON */}
          <button
            type="button"
            onClick={onToggleRecording}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FF6B35]/70 transition cursor-pointer ${
              isRecording ? 'text-[#FF6B35] bg-[#0D0B14]' : 'bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 text-[#F8F7FC]'
            }`}
            title={isRecording ? 'Stop Recording' : 'Record Meeting'}
          >
            <Circle className={`w-4 h-4 ${isRecording ? 'fill-[#FF6B35] text-[#FF6B35] animate-pulse' : 'text-[#FF6B35]'}`} />
            <span className="text-[11px] font-semibold">
              {isRecording ? 'Rec' : 'Record'}
            </span>
          </button>

          {/* REACTIONS & RAISE HAND */}
          <div ref={reactionsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowReactionsMenu(v => !v);
                setShowAudioMenu(false);
                setShowVideoMenu(false);
                setShowSecurityMenu(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FF6B35]/70 transition cursor-pointer ${
                isHandRaised ? 'bg-[#FF6B35] text-[#0D0B14]' : 'bg-[#0D0B14]/50 hover:bg-[#0D0B14]/80 text-[#F8F7FC]'
              }`}
              title="Send Reactions & Raise Hand"
            >
              {isHandRaised ? <Hand className="w-4 h-4 text-[#0D0B14] animate-bounce" /> : <Smile className="w-4 h-4 text-[#FF6B35]" />}
              <span className="text-[11px] font-semibold hidden sm:inline">
                {isHandRaised ? 'Raised' : 'React'}
              </span>
            </button>

            {/* Reactions Popover - Floats above the pill dock */}
            {showReactionsMenu && (
              <div className="absolute bottom-full mb-3 right-0 sm:left-1/2 sm:-translate-x-1/2 w-64 rounded-2xl p2p-dropdown border border-[#FF6B35]/70 p-3 text-xs shadow-2xl text-[#F8F7FC] z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(196,181,253,0.14)] mb-2.5">
                  {quickReactions.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onSendReaction?.(emoji);
                        soundSynth.playEmojiSound(emoji);
                        setShowReactionsMenu(false);
                      }}
                      className="text-xl p-1 rounded-xl hover:bg-[rgba(196,181,253,0.15)] hover:scale-125 transition transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    onToggleRaiseHand?.();
                    setShowReactionsMenu(false);
                  }}
                  className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition shadow cursor-pointer ${
                    isHandRaised
                      ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14]'
                      : 'bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FFA14A] border border-[#FF6B35]/40'
                  }`}
                >
                  <Hand className="w-4 h-4" />
                  <span>{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-6 w-[1px] bg-[rgba(196,181,253,0.16)] mx-0.5 hidden sm:block shrink-0" />

          {/* 4. LEAVE / END BUTTON (SUBTLE TRANSLUCENT ORANGE PILL) */}
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="px-4 py-1.5 rounded-full bg-[#FF6B35]/25 hover:bg-[#FF6B35]/40 border border-[#FF6B35]/70 text-[#FFA14A] hover:text-white font-bold text-xs transition cursor-pointer shrink-0"
          >
            {isHost ? 'End' : 'Leave'}
          </button>
        </div>
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
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] hover:brightness-110 text-[#0D0B14] font-bold text-xs transition shadow-lg shadow-[#FF6B35]/25 cursor-pointer"
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
