'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Authentic Zoom Bottom Control Toolbar & Features
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Video, VideoOff, ChevronUp, Users,
  MessageSquare, Smile, PhoneOff, Check, Shield,
  Share2, Radio, Circle, Hand, Palette, Clapperboard,
  Sliders, Volume2, Sparkles, X, Lock, Unlock, Eye, EyeOff, Monitor, Layers,
  GraduationCap, Info
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

  return (
    <>
      <footer className={`absolute bottom-0 left-0 right-0 h-16 sm:h-18 bg-[#161324]/92 backdrop-blur-2xl border-t border-[rgba(196,181,253,0.14)] z-40 flex items-center justify-between px-2 sm:px-6 select-none shadow-2xl transition-transform duration-200 overflow-x-auto scrollbar-none gap-1 sm:gap-2 ${
        isVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}>
        {/* 1. LEFT CONTROLS: MUTE / UNMUTE & START / STOP VIDEO */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          {/* MUTE / UNMUTE BUTTON WITH CHEVRON */}
          <div ref={audioMenuRef} className="relative flex items-center">
            <button
              onClick={toggleAudio}
              className={`flex flex-col items-center justify-center min-w-[46px] sm:min-w-[62px] h-13 px-1.5 sm:px-2 rounded-xl transition hover:bg-[rgba(196,181,253,0.08)] ${
                !audioEnabled ? 'text-[#FF6B35]' : 'text-[#F8F7FC]'
              }`}
              title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              <div className="relative">
                {audioEnabled ? <Mic className="w-5 h-5 text-[#F8F7FC]" /> : <MicOff className="w-5 h-5 text-[#FF6B35]" />}
                {/* Real-time audio wave indicator on mic icon */}
                {audioEnabled && audioLevel > 15 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF6B35] animate-ping" />
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium tracking-tight mt-0.5">
                {audioEnabled ? 'Mute' : 'Unmute'}
              </span>
            </button>

            <button
              onClick={() => setShowAudioMenu(v => !v)}
              className="h-13 px-1 rounded-lg text-[#C4B5FD]/70 hover:text-[#F8F7FC] hover:bg-[rgba(196,181,253,0.08)] transition"
              title="Select Microphone & Speaker"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Audio Settings Popover */}
            {showAudioMenu && (
              <div className="absolute bottom-16 left-0 w-72 rounded-2xl bg-[#221C35] border border-[rgba(196,181,253,0.18)] p-2 text-xs shadow-2xl text-[#F8F7FC] z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Select a Microphone</div>
                {devices.audio.length > 0 ? (
                  devices.audio.map(d => (
                    <button
                      key={d.deviceId}
                      onClick={() => { switchMicrophone(d.deviceId); setShowAudioMenu(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition ${
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
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition ${
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition ${
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
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] text-[#FFA14A] font-medium flex items-center gap-2 transition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Test Speaker & Chime</span>
                </button>
              </div>
            )}
          </div>

          {/* START / STOP VIDEO BUTTON WITH CHEVRON */}
          <div ref={videoMenuRef} className="relative flex items-center">
            <button
              onClick={toggleVideo}
              className={`flex flex-col items-center justify-center min-w-[54px] sm:min-w-[66px] h-13 px-2 rounded-xl transition hover:bg-[rgba(196,181,253,0.08)] ${
                !videoEnabled ? 'text-[#FF6B35]' : 'text-[#F8F7FC]'
              }`}
              title={videoEnabled ? 'Stop Video' : 'Start Video'}
            >
              {videoEnabled ? <Video className="w-5 h-5 text-[#F8F7FC]" /> : <VideoOff className="w-5 h-5 text-[#FF6B35]" />}
              <span className="text-[10px] sm:text-[11px] font-medium tracking-tight mt-0.5">
                {videoEnabled ? 'Stop Video' : 'Start Video'}
              </span>
            </button>

            <button
              onClick={() => setShowVideoMenu(v => !v)}
              className="h-13 px-1 rounded-lg text-[#C4B5FD]/70 hover:text-[#F8F7FC] hover:bg-[rgba(196,181,253,0.08)] transition"
              title="Camera & Virtual Backgrounds"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Video Settings Popover */}
            {showVideoMenu && (
              <div className="absolute bottom-16 left-0 w-80 rounded-2xl bg-[#221C35] border border-[rgba(196,181,253,0.18)] p-2.5 text-xs shadow-2xl text-[#F8F7FC] z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center gap-1 bg-[#0D0B14] p-1 rounded-xl mb-2 border border-[rgba(196,181,253,0.12)]">
                  <button
                    onClick={() => setVideoMenuTab('effects')}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition ${
                      videoMenuTab === 'effects' ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold' : 'text-[#C4B5FD]/70 hover:text-[#F8F7FC]'
                    }`}
                  >
                    Virtual Backgrounds
                  </button>
                  <button
                    onClick={() => setVideoMenuTab('devices')}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition ${
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
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition ${
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
                          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
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
        </div>

        {/* 2. CENTER CONTROLS: SECURITY, PARTICIPANTS, CHAT, SHARE SCREEN, WHITEBOARD, RECORD, REACTIONS */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* SECURITY MENU (Host Feature) */}
          {isHost && (
            <div ref={securityMenuRef} className="relative hidden md:block">
              <button
                onClick={() => setShowSecurityMenu(v => !v)}
                className={`flex flex-col items-center justify-center min-w-[56px] h-13 px-2 rounded-xl transition hover:bg-[rgba(196,181,253,0.08)] ${
                  showSecurityMenu ? 'bg-[rgba(196,181,253,0.18)] text-[#C4B5FD]' : 'text-[#F8F7FC]/85 hover:text-[#F8F7FC]'
                }`}
                title="Security Options"
              >
                <Shield className="w-5 h-5 text-[#C4B5FD]" />
                <span className="text-[11px] font-medium tracking-tight mt-0.5">Security</span>
              </button>

              {showSecurityMenu && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 rounded-2xl bg-[#221C35] border border-[rgba(196,181,253,0.18)] p-2.5 text-xs shadow-2xl text-[#F8F7FC] z-50">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Lock & Access</div>
                  <button
                    onClick={() => onUpdateSecurity?.({ lockMeeting: !securitySettings.lockMeeting })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition"
                  >
                    <span>Lock Meeting</span>
                    {securitySettings.lockMeeting ? <Check className="w-3.5 h-3.5 text-[#FF6B35]" /> : <Lock className="w-3 h-3 text-[#C4B5FD]/40" />}
                  </button>

                  <div className="h-[1px] bg-[rgba(196,181,253,0.14)] my-1.5" />

                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4B5FD]">Allow Participants to:</div>
                  <button
                    onClick={() => onUpdateSecurity?.({ allowScreenShare: !securitySettings.allowScreenShare })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition"
                  >
                    <span>Share Screen</span>
                    {securitySettings.allowScreenShare && <Check className="w-3.5 h-3.5 text-[#FF6B35]" />}
                  </button>

                  <button
                    onClick={() => onUpdateSecurity?.({ allowChat: !securitySettings.allowChat })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition"
                  >
                    <span>Chat</span>
                    {securitySettings.allowChat && <Check className="w-3.5 h-3.5 text-[#FF6B35]" />}
                  </button>

                  <button
                    onClick={() => onUpdateSecurity?.({ allowRename: !securitySettings.allowRename })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition"
                  >
                    <span>Rename Themselves</span>
                    {securitySettings.allowRename && <Check className="w-3.5 h-3.5 text-[#FF6B35]" />}
                  </button>

                  <button
                    onClick={() => onUpdateSecurity?.({ allowUnmute: !securitySettings.allowUnmute })}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-[rgba(196,181,253,0.10)] flex items-center justify-between text-xs transition"
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
            onClick={() => onTogglePanel?.('participants')}
            className={`flex flex-col items-center justify-center min-w-[56px] h-13 px-2 rounded-xl transition hover:bg-[rgba(196,181,253,0.08)] ${
              activePanel === 'participants' ? 'bg-[rgba(196,181,253,0.18)] text-[#C4B5FD] border border-[rgba(196,181,253,0.3)]' : 'text-[#F8F7FC]/85 hover:text-[#F8F7FC]'
            }`}
            title="Participants List"
          >
            <div className="relative">
              <Users className="w-5 h-5 text-[#F8F7FC]" />
              <span className="absolute -top-1 -right-2 px-1 rounded-full bg-[#FF6B35] text-[9px] font-bold text-[#0D0B14]">
                {participantCount}
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium tracking-tight mt-0.5">Participants</span>
          </button>

          {/* CHAT BUTTON */}
          <button
            onClick={() => onTogglePanel?.('chat')}
            className={`flex flex-col items-center justify-center min-w-[50px] sm:min-w-[56px] h-13 px-2 rounded-xl transition hover:bg-[rgba(196,181,253,0.08)] ${
              activePanel === 'chat' ? 'bg-[rgba(196,181,253,0.18)] text-[#C4B5FD] border border-[rgba(196,181,253,0.3)]' : 'text-[#F8F7FC]/85 hover:text-[#F8F7FC]'
            }`}
            title="Meeting Chat"
          >
            <MessageSquare className="w-5 h-5 text-[#F8F7FC]" />
            <span className="text-[10px] sm:text-[11px] font-medium tracking-tight mt-0.5">Chat</span>
          </button>

          {/* SHARE SCREEN */}
          <div className="relative flex items-center">
            <button
              onClick={() => {
                if (screenSharing) {
                  stopScreenShare();
                } else {
                  startScreenShare({ surface: 'monitor', isWatchParty: false });
                }
              }}
              className={`flex flex-col items-center justify-center min-w-[64px] sm:min-w-[76px] h-13 px-2.5 rounded-xl transition shadow-lg ${
                screenSharing
                  ? 'bg-[#FF6B35] hover:bg-[#FF854D] text-[#0D0B14] font-bold'
                  : 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] hover:brightness-110 text-[#0D0B14] font-bold shadow-[#FF6B35]/25'
              }`}
              title={screenSharing ? 'Stop Screen Sharing' : 'Share Screen (Entire Desktop / OS Layer Default)'}
            >
              <Share2 className="w-5 h-5" />
              <span className="text-[10px] sm:text-[11px] font-bold tracking-tight mt-0.5">
                {screenSharing ? 'Stop Share' : 'Share Screen'}
              </span>
              {screenSharing && (
                <span className="hidden sm:inline text-[8px] font-semibold text-[#0D0B14] bg-white/70 px-1 rounded mt-0.5">
                  510kbps Hi-Fi
                </span>
              )}
            </button>
          </div>

          {/* WHITEBOARD BUTTON */}
          <button
            onClick={onToggleWhiteboard}
            className={`hidden md:flex flex-col items-center justify-center min-w-[62px] h-13 px-2 rounded-xl transition hover:bg-[rgba(196,181,253,0.08)] ${
              whiteboardActive ? 'bg-[rgba(196,181,253,0.22)] text-[#C4B5FD] border border-[rgba(196,181,253,0.3)]' : 'text-[#F8F7FC]/85 hover:text-[#F8F7FC]'
            }`}
            title="Open Interactive Whiteboard"
          >
            <Palette className="w-5 h-5 text-[#F8F7FC]" />
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Whiteboard</span>
          </button>

          {/* RECORD BUTTON */}
          <button
            onClick={onToggleRecording}
            className={`hidden md:flex flex-col items-center justify-center min-w-[56px] h-13 px-2 rounded-xl transition hover:bg-[rgba(196,181,253,0.08)] ${
              isRecording ? 'text-[#FF6B35] bg-[rgba(255,107,53,0.2)]' : 'text-[#F8F7FC]/85 hover:text-[#F8F7FC]'
            }`}
            title={isRecording ? 'Stop Recording' : 'Record to Computer'}
          >
            <Circle className={`w-5 h-5 ${isRecording ? 'fill-[#FF6B35] text-[#FF6B35] animate-pulse' : 'text-[#F8F7FC]'}`} />
            <span className="text-[11px] font-medium tracking-tight mt-0.5">
              {isRecording ? 'Recording' : 'Record'}
            </span>
          </button>

          {/* REACTIONS & RAISE HAND */}
          <div ref={reactionsMenuRef} className="relative">
            <button
              onClick={() => setShowReactionsMenu(v => !v)}
              className={`flex flex-col items-center justify-center min-w-[54px] sm:min-w-[62px] h-13 px-2 rounded-xl transition hover:bg-[rgba(196,181,253,0.08)] ${
                isHandRaised ? 'bg-[rgba(255,107,53,0.20)] text-[#FFA14A]' : 'text-[#F8F7FC]/85 hover:text-[#F8F7FC]'
              }`}
              title="Send Reactions & Raise Hand"
            >
              {isHandRaised ? <Hand className="w-5 h-5 text-[#FFA14A] animate-bounce" /> : <Smile className="w-5 h-5 text-[#F8F7FC]" />}
              <span className="text-[10px] sm:text-[11px] font-medium tracking-tight mt-0.5">
                {isHandRaised ? 'Hand Up' : 'Reactions'}
              </span>
            </button>

            {/* Reactions Popover with Raise Hand */}
            {showReactionsMenu && (
              <div className="absolute bottom-16 right-0 sm:left-1/2 sm:-translate-x-1/2 w-64 rounded-2xl bg-[#221C35] border border-[rgba(196,181,253,0.18)] p-3 text-xs shadow-2xl text-[#F8F7FC] z-50">
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(196,181,253,0.14)] mb-2.5">
                  {quickReactions.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onSendReaction?.(emoji);
                        soundSynth.playEmojiSound(emoji);
                        setShowReactionsMenu(false);
                      }}
                      className="text-xl p-1 rounded-xl hover:bg-[rgba(196,181,253,0.15)] hover:scale-125 transition transform"
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
                  className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition shadow ${
                    isHandRaised
                      ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14]'
                      : 'bg-[rgba(196,181,253,0.18)] hover:bg-[rgba(196,181,253,0.28)] text-[#C4B5FD]'
                  }`}
                >
                  <Hand className="w-4 h-4" />
                  <span>{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. RIGHT CONTROLS: RED/ORANGE END / LEAVE BUTTON */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setShowLeaveModal(true)}
            className="px-3.5 sm:px-5 py-2 sm:py-2 rounded-xl bg-[#FF6B35] hover:bg-[#FF854D] text-[#0D0B14] font-bold text-xs sm:text-sm shadow-lg shadow-[#FF6B35]/25 transition"
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
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] hover:brightness-110 text-[#0D0B14] font-bold text-xs transition shadow-lg shadow-[#FF6B35]/25"
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
                className="w-full py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#FF854D] text-[#0D0B14] font-bold text-xs transition shadow-md shadow-[#FF6B35]/20"
              >
                Leave Meeting
              </button>
              )}

              <button
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-2 text-[#C4B5FD]/50 hover:text-[#F8F7FC] text-xs transition mt-1"
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
