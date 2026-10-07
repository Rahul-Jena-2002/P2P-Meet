'use client';
/*
 * p2pmeet - Decentralized Privacy-First Video Meetings
 * Copyright (C) 2026 p2pmeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, ChevronUp, Users,
  MessageSquare, Smile, PhoneOff, Check,
  Sparkles, ArrowUpRight, Sliders, Volume2, VolumeX, Eye,
  MoreHorizontal, FileText, Clapperboard
} from 'lucide-react';
import { useMedia } from './MediaProvider';
import { soundSynth } from '../lib/soundEffects';

export default function P2PControls({
  roomCode,
  isHost,
  participantCount,
  activePanel,
  onTogglePanel,
  onSendReaction,
  onLeaveMeeting,
  onStartWatchTogether,
  onStopWatchTogether,
  watchTogetherActive,
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
    toggleAudio,
    toggleVideo,
    switchCamera,
    switchMicrophone,
    switchAudioOutput,
    testAudioOutput,
    startScreenShare,
    stopScreenShare
  } = useMedia();

  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [testingSpeaker, setTestingSpeaker] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [videoMenuTab, setVideoMenuTab] = useState('effects'); // 'devices' | 'effects'
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [reactionCategory, setReactionCategory] = useState('emotions'); // 'emotions' | 'animals' | 'gestures' | 'celebrations'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [showMobileMoreSheet, setShowMobileMoreSheet] = useState(false);

  const filterOptions = [
    { id: 'none', label: 'Normal Camera', icon: '✨', category: 'base' },
    { id: 'blur', label: 'Green Screen Blur', icon: '🌫️', desc: 'Face sharp, room blurred', category: 'ai' },
    { id: 'studio', label: 'Executive Studio', icon: '🏢', desc: 'Modern loft office background', img: '/backgrounds/studio.jpg', category: 'ai' },
    { id: 'rocket', label: 'Inside Rocket', icon: '🚀', desc: 'Sci-fi starship cockpit', img: '/backgrounds/rocket.jpg', category: 'ai' },
    { id: 'nature', label: 'Tropical Nature', icon: '🌿', desc: 'Serene forest waterfall', img: '/backgrounds/nature.jpg', category: 'ai' },
    { id: 'moon', label: 'Moon Surface', icon: '🌕', desc: 'Lunar landscape & Earth in space', img: '/backgrounds/moon.jpg', category: 'ai' },
    { id: 'astronaut', label: 'Astronaut Suit', icon: '👨‍🚀', desc: 'Your face in helmet on moon', img: '/backgrounds/astronaut.jpg', category: 'ai' },
    { id: 'cinema', label: 'Cinema Teal & Gold', icon: '🎬', category: 'grade' },
    { id: 'cyberpunk', label: 'Neon Cyberpunk', icon: '🔮', category: 'grade' },
    { id: 'warm', label: 'Golden Hour Warmth', icon: '☀️', category: 'grade' },
    { id: 'noir', label: 'Noir (B&W)', icon: '🎞️', category: 'grade' },
    { id: 'vivid', label: 'Vivid Pop', icon: '🎨', category: 'grade' },
  ];

  const emojiCategories = {
    emotions: {
      name: 'Smileys',
      emojis: [
        { char: '😂', name: 'Joy' },
        { char: '🤣', name: 'ROFL' },
        { char: '😍', name: 'Love' },
        { char: '🥳', name: 'Party' },
        { char: '😎', name: 'Cool' },
        { char: '🤩', name: 'Star' },
        { char: '🥺', name: 'Please' },
        { char: '😴', name: 'Sleepy' },
        { char: '🤯', name: 'Mindblown' },
        { char: '😇', name: 'Angel' },
      ]
    },
    animals: {
      name: 'Animals',
      emojis: [
        { char: '🐶', name: 'Dog' },
        { char: '🐱', name: 'Cat' },
        { char: '🦁', name: 'Lion' },
        { char: '🐼', name: 'Panda' },
        { char: '🦊', name: 'Fox' },
        { char: '🐸', name: 'Frog' },
        { char: '🐵', name: 'Monkey' },
        { char: '🦄', name: 'Unicorn' },
        { char: '🐝', name: 'Bee' },
        { char: '🦉', name: 'Owl' },
      ]
    },
    gestures: {
      name: 'Gestures',
      emojis: [
        { char: '👍', name: 'Thumbs Up' },
        { char: '👏', name: 'Clap' },
        { char: '🙌', name: 'High Five' },
        { char: '✌️', name: 'Peace' },
        { char: '🤝', name: 'Handshake' },
        { char: '✊', name: 'Fist' },
        { char: '🤙', name: 'Call Me' },
        { char: '🫶', name: 'Heart Hands' },
        { char: '🙏', name: 'Thank You' },
        { char: '👎', name: 'Thumbs Down' },
      ]
    },
    celebrations: {
      name: 'Vibes',
      emojis: [
        { char: '🎉', name: 'Popper' },
        { char: '🚀', name: 'Rocket' },
        { char: '🔥', name: 'Fire' },
        { char: '✨', name: 'Sparkles' },
        { char: '💯', name: '100' },
        { char: '💖', name: 'Pink Heart' },
        { char: '🍕', name: 'Pizza' },
        { char: '☕', name: 'Coffee' },
        { char: '⚡', name: 'Zap' },
        { char: '🌈', name: 'Rainbow' },
      ]
    }
  };

  const handleTriggerEmoji = (emojiChar) => {
    if (soundEnabled) {
      soundSynth.playEmojiSound(emojiChar);
    }
    onSendReaction(emojiChar);
    setShowReactionsMenu(false);
  };

  // Close any popup menu when clicking anywhere on the screen outside
  React.useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        e.target.closest('.p2p-dropdown') ||
        e.target.closest('[data-dropdown-trigger]')
      ) {
        return;
      }
      setShowAudioMenu(false);
      setShowVideoMenu(false);
      setShowReactionsMenu(false);
      setShowWatchModal(false);
    };

    if (showAudioMenu || showVideoMenu || showReactionsMenu || showWatchModal) {
      const timer = setTimeout(() => {
        window.addEventListener('click', handleOutsideClick);
        window.addEventListener('touchstart', handleOutsideClick, { passive: true });
      }, 10);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('click', handleOutsideClick);
        window.removeEventListener('touchstart', handleOutsideClick);
      };
    }
  }, [showAudioMenu, showVideoMenu, showReactionsMenu, showWatchModal]);

  return (
    <>
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-40 select-none p2p-overlay-bar w-auto max-w-[98%] ${
          isVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
        style={{ bottom: 'max(10px, calc(env(safe-area-inset-bottom, 0px) + 6px))' }}
      >
        {isMobile ? (
          /* A. MOBILE 5-BUTTON DOCK (Teams / Zoom Mobile Style) */
          <div className={`flex items-center justify-around gap-1 px-3 py-1.5 rounded-2xl p2p-dock shadow-2xl ${
            isMobileLandscape ? 'w-[80vw] max-w-[340px] py-1' : 'w-[92vw] max-w-[380px]'
          }`}>
            {/* 1. Mute */}
            <button
              onClick={toggleAudio}
              className={`flex flex-col items-center justify-center w-12 h-11 rounded-xl transition ${
                audioEnabled ? 'hover:bg-white/10 text-[#F5E8D8]' : 'bg-[#FF4500] text-white shadow-md shadow-[#FF4500]/30'
              }`}
              title={audioEnabled ? "Mute" : "Unmute"}
            >
              {audioEnabled ? (
                <div className="relative">
                  <Mic className="w-4 h-4 text-[#F5E8D8]" />
                  {audioLevel > 15 && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#DAA520]" />
                  )}
                </div>
              ) : (
                <MicOff className="w-4 h-4" />
              )}
              <span className="text-[9px] font-medium mt-0.5">{audioEnabled ? 'Mute' : 'Unmute'}</span>
            </button>

            {/* 2. Video */}
            <button
              onClick={toggleVideo}
              className={`flex flex-col items-center justify-center w-12 h-11 rounded-xl transition ${
                videoEnabled ? 'hover:bg-white/10 text-[#F5E8D8]' : 'bg-[#FF4500] text-white shadow-md shadow-[#FF4500]/30'
              }`}
              title={videoEnabled ? "Stop Video" : "Start Video"}
            >
              {videoEnabled ? <Video className="w-4 h-4 text-[#F5E8D8]" /> : <VideoOff className="w-4 h-4" />}
              <span className="text-[9px] font-medium mt-0.5">{videoEnabled ? 'Stop' : 'Start'}</span>
            </button>

            {/* 3. Screen Share */}
            <button
              onClick={screenSharing ? stopScreenShare : startScreenShare}
              className={`flex flex-col items-center justify-center w-12 h-11 rounded-xl transition ${
                screenSharing ? 'bg-[#FF4500] text-white' : 'hover:bg-white/10 text-[#F5E8D8]'
              }`}
              title={screenSharing ? "Stop Sharing" : "Share Screen"}
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              <span className="text-[9px] font-medium mt-0.5">{screenSharing ? 'Stop' : 'Share'}</span>
            </button>

            {/* 4. Chat */}
            <button
              onClick={() => onTogglePanel('chat')}
              className={`flex flex-col items-center justify-center w-12 h-11 rounded-xl transition ${
                activePanel === 'chat' ? 'bg-[#FF6F61] text-[#1C1C1C] font-bold' : 'hover:bg-white/10 text-[#F5E8D8]'
              }`}
              title="Chat"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-[9px] font-medium mt-0.5">Chat</span>
            </button>

            {/* 5. More (⋯) */}
            <button
              onClick={() => setShowMobileMoreSheet(true)}
              className="flex flex-col items-center justify-center w-12 h-11 rounded-xl hover:bg-white/10 text-[#F5E8D8] transition"
              title="More Options"
            >
              <MoreHorizontal className="w-4 h-4 text-[#DAA520]" />
              <span className="text-[9px] font-medium mt-0.5">More</span>
            </button>
          </div>
        ) : (
          /* B. DESKTOP FULL DOCK */
          <div className="flex items-center gap-1 sm:gap-3 md:gap-3.5 px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-2xl sm:rounded-3xl p2p-dock shadow-2xl max-w-full">
          {/* 1. MUTE / AUDIO */}
          <div className="relative flex items-center gap-0.5">
          <button
            onClick={toggleAudio}
            className={`flex flex-col items-center justify-center w-9 sm:w-auto sm:min-w-[58px] h-10 sm:h-12 px-1 sm:px-2 py-1 rounded-xl transition ${
              audioEnabled
                ? 'hover:bg-white/[0.06] text-[#F5E8D8] border border-transparent'
                : 'bg-[#FF4500]/15 text-[#FF4500] border border-[#FF4500]/30 hover:bg-[#FF4500]/25'
            }`}
            title={audioEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {audioEnabled ? (
              <div className="relative">
                <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-[#F5E8D8]" />
                {audioLevel > 15 && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#DAA520]" />
                )}
              </div>
            ) : (
              <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
            <span className="text-[10px] font-medium mt-1 whitespace-nowrap hidden sm:inline">{audioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>

          <button
            data-dropdown-trigger="audio"
            onClick={(e) => {
              e.stopPropagation();
              setShowAudioMenu(s => !s);
              setShowVideoMenu(false);
              setShowReactionsMenu(false);
              setShowWatchModal(false);
            }}
            className="hidden sm:block p-1 text-[#F5E8D8]/50 hover:text-[#F5E8D8] hover:bg-white/[0.06] rounded-lg transition"
            title="Audio Settings"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Audio Device Dropdown (Input & Output) */}
          {showAudioMenu && (
            <div className="absolute bottom-16 left-0 w-72 sm:w-80 rounded-2xl p2p-dropdown p-3.5 text-xs text-[#F5E8D8] z-50 animate-in fade-in slide-in-from-bottom-2 shadow-2xl border border-white/10 backdrop-blur-xl bg-[#1C1C1C]/95">
              {/* SECTION 1: MICROPHONE (INPUT) */}
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5E8D8]/50 flex items-center gap-1.5">
                  <Mic className="w-3 h-3 text-[#FF6F61]" />
                  Select Microphone (Input)
                </span>
                {/* Live audio level indicator */}
                <div className="flex items-center gap-1">
                  <div className="w-12 h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-[#FF6F61] transition-all duration-75"
                      style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                {devices.audio.length > 0 ? (
                  devices.audio.map((d) => (
                    <button
                      key={d.deviceId}
                      onClick={() => { switchMicrophone(d.deviceId); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                        selectedMic === d.deviceId ? 'bg-[#FF6F61] text-[#1C1C1C] font-semibold shadow-sm' : 'hover:bg-white/[0.06] text-[#F5E8D8]/90'
                      }`}
                    >
                      <span className="truncate pr-2">{d.label || `Microphone ${d.deviceId.substring(0, 5)}`}</span>
                      {selectedMic === d.deviceId && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))
                ) : (
                  <div className="px-2.5 py-1 text-[11px] text-[#F5E8D8]/40">Default Microphone</div>
                )}
              </div>

              {/* SEPARATOR */}
              <div className="my-2.5 border-t border-white/[0.08]" />

              {/* SECTION 2: SOUND OUTPUT (SPEAKER / HEADPHONES) */}
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5E8D8]/50 flex items-center gap-1.5">
                  <Volume2 className="w-3 h-3 text-[#DAA520]" />
                  Sound Output (Speaker)
                </span>
                <span className="text-[9px] text-[#F5E8D8]/40">Playback</span>
              </div>

              <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                {devices.audioOutput && devices.audioOutput.length > 0 ? (
                  devices.audioOutput.map((d) => (
                    <button
                      key={d.deviceId}
                      onClick={() => { switchAudioOutput(d.deviceId); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                        selectedSpeaker === d.deviceId ? 'bg-[#DAA520] text-[#1C1C1C] font-semibold shadow-sm' : 'hover:bg-white/[0.06] text-[#F5E8D8]/90'
                      }`}
                    >
                      <span className="truncate pr-2">{d.label || `Speaker ${d.deviceId.substring(0, 5)}`}</span>
                      {selectedSpeaker === d.deviceId && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => switchAudioOutput('default')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between bg-white/[0.04] text-[#F5E8D8]/90"
                  >
                    <span className="truncate">Default System Audio Output</span>
                    <Check className="w-3.5 h-3.5 text-[#DAA520] shrink-0" />
                  </button>
                )}
              </div>

              {/* Test Speaker Chime Button */}
              <div className="mt-2.5 pt-2 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    setTestingSpeaker(true);
                    testAudioOutput(selectedSpeaker);
                    setTimeout(() => setTestingSpeaker(false), 1400);
                  }}
                  className={`w-full py-1.5 px-3 rounded-xl flex items-center justify-center gap-2 font-medium text-[11px] transition ${
                    testingSpeaker
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/[0.06] hover:bg-white/[0.10] text-[#F5E8D8] border border-white/[0.08]'
                  }`}
                >
                  <Volume2 className={`w-3.5 h-3.5 ${testingSpeaker ? 'animate-bounce text-emerald-400' : 'text-[#DAA520]'}`} />
                  {testingSpeaker ? 'Playing Test Sound...' : 'Test Speaker Output'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. VIDEO / CAMERA WITH BLUR & FILTERS */}
        <div className="relative flex items-center gap-0.5">
          <button
            onClick={toggleVideo}
            className={`flex flex-col items-center justify-center w-9 sm:w-auto sm:min-w-[58px] h-10 sm:h-12 px-1 sm:px-2 py-1 rounded-xl transition ${
              videoEnabled
                ? 'hover:bg-white/[0.06] text-[#F5E8D8] border border-transparent'
                : 'bg-[#FF4500]/15 text-[#FF4500] border border-[#FF4500]/30 hover:bg-[#FF4500]/25'
            }`}
            title={videoEnabled ? "Stop Camera" : "Start Camera"}
          >
            {videoEnabled ? <Video className="w-4 h-4 sm:w-5 sm:h-5 text-[#F5E8D8]" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
            <span className="text-[10px] font-medium mt-1 whitespace-nowrap hidden sm:inline">{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
          </button>

          <button
            data-dropdown-trigger="video"
            onClick={(e) => {
              e.stopPropagation();
              setShowVideoMenu(s => !s);
              setShowAudioMenu(false);
              setShowReactionsMenu(false);
              setShowWatchModal(false);
            }}
            className="hidden sm:block p-1 text-[#F5E8D8]/50 hover:text-[#F5E8D8] hover:bg-white/[0.06] rounded-lg transition"
            title="Video & Background Filter Settings"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Video Options & Background Filters Dropdown (Desktop) */}
          {showVideoMenu && !isMobile && (
            <div className="absolute bottom-16 left-0 w-80 sm:w-96 rounded-2xl p2p-dropdown p-4 text-xs text-[#F5E8D8] z-50 animate-in fade-in slide-in-from-bottom-2 shadow-2xl space-y-3">
              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-[#F5E8D8]/10 text-xs">
                <button
                  onClick={() => setVideoMenuTab('effects')}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                    videoMenuTab === 'effects' ? 'bg-[#FF6F61] text-[#1C1C1C] font-semibold' : 'text-[#F5E8D8]/60 hover:text-[#F5E8D8]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Virtual Backgrounds</span>
                </button>
                <button
                  onClick={() => setVideoMenuTab('devices')}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                    videoMenuTab === 'devices' ? 'bg-[#FF6F61] text-[#1C1C1C] font-semibold' : 'text-[#F5E8D8]/60 hover:text-[#F5E8D8]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Camera</span>
                </button>
              </div>

              {videoMenuTab === 'effects' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[#F5E8D8]/60 px-0.5">
                    <span className="font-semibold text-[#F5E8D8]">Green Screen & Backgrounds</span>
                    <span className="font-mono text-[#DAA520]">{filterOptions.find(f => f.id === videoFilter)?.label}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#DAA520] tracking-wider block mb-1.5 px-0.5">
                      ✦ AI Virtual Backgrounds & Blur
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {filterOptions.filter(f => f.category === 'base' || f.category === 'ai').map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setVideoFilter?.(f.id)}
                          className={`p-2 rounded-xl text-left transition border relative overflow-hidden group flex flex-col justify-between h-20 active:scale-98 ${
                            videoFilter === f.id
                              ? 'bg-[#DAA520]/25 border-[#DAA520] text-[#DAA520] shadow-md ring-1 ring-[#DAA520]'
                              : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-[#F5E8D8]'
                          }`}
                        >
                          {f.img && (
                            <div
                              className="absolute inset-0 opacity-25 group-hover:opacity-40 transition bg-cover bg-center pointer-events-none"
                              style={{ backgroundImage: `url(${f.img})` }}
                            />
                          )}
                          <div className="relative z-10 flex items-center justify-between w-full">
                            <span className="text-xl">{f.icon}</span>
                            {videoFilter === f.id && (
                              <span className="p-0.5 rounded-full bg-[#DAA520] text-[#1C1C1C]">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <div className="relative z-10">
                            <span className="text-xs font-bold block leading-tight truncate">{f.label}</span>
                            {f.desc && <span className="text-[9px] text-[#F5E8D8]/60 block leading-tight truncate mt-0.5">{f.desc}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[10px] uppercase font-bold text-[#F5E8D8]/50 tracking-wider block mb-1.5 px-0.5">
                      Color Grades
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {filterOptions.filter(f => f.category === 'grade').map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setVideoFilter?.(f.id)}
                          className={`px-2 py-1.5 rounded-lg text-left transition border text-[11px] font-medium flex items-center gap-1.5 ${
                            videoFilter === f.id
                              ? 'bg-[#DAA520]/20 border-[#DAA520] text-[#DAA520] font-semibold'
                              : 'bg-white/[0.03] border-transparent hover:bg-white/[0.07] text-[#F5E8D8]'
                          }`}
                        >
                          <span>{f.icon}</span>
                          <span className="truncate">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5E8D8]/50 px-1 block">
                    Select Camera Device
                  </span>
                  {devices.video.map((d) => (
                    <button
                      key={d.deviceId}
                      onClick={() => { switchCamera(d.deviceId); setShowVideoMenu(false); }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition ${
                        selectedCam === d.deviceId ? 'bg-[#FF6F61] text-[#1C1C1C] font-semibold' : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="truncate">{d.label || `Camera ${d.deviceId.substring(0, 5)}`}</span>
                      {selectedCam === d.deviceId && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-[1px] h-6 sm:h-7 bg-[#F5E8D8]/10 mx-0.5 shrink-0" />

        {/* 3. PARTICIPANTS */}
        <button
          onClick={() => onTogglePanel('participants')}
          className={`flex flex-col items-center justify-center w-9 sm:w-auto sm:min-w-[70px] h-10 sm:h-12 px-1 sm:px-2 py-1 rounded-xl transition ${
            activePanel === 'participants' ? 'bg-[#FF6F61]/20 text-[#FF6F61] border border-[#FF6F61]/40' : 'hover:bg-white/[0.06] text-[#F5E8D8]'
          }`}
          title="Participants"
        >
          <div className="relative flex items-center justify-center">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full bg-[#FF6F61] text-[9px] font-bold text-[#1C1C1C] shadow-sm">
              {participantCount}
            </span>
          </div>
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap hidden sm:inline">Participants</span>
        </button>

        {/* 4. CHAT */}
        <button
          onClick={() => onTogglePanel('chat')}
          className={`flex flex-col items-center justify-center w-9 sm:w-auto sm:min-w-[54px] h-10 sm:h-12 px-1 sm:px-2 py-1 rounded-xl transition ${
            activePanel === 'chat' ? 'bg-[#FF6F61]/20 text-[#FF6F61] border border-[#FF6F61]/40' : 'hover:bg-white/[0.06] text-[#F5E8D8]'
          }`}
          title="Chat & Direct P2P Files"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap hidden sm:inline">Chat</span>
        </button>

        {/* 5. PRIMARY ACTION "SHARE SCREEN" */}
        <button
          onClick={screenSharing ? stopScreenShare : startScreenShare}
          className={`flex flex-col items-center justify-center w-9 sm:w-auto sm:min-w-[76px] h-10 sm:h-12 px-1 sm:px-3 py-1 rounded-xl transition ${
            screenSharing
              ? 'bg-[#FF4500] hover:bg-[#FF4500]/80 text-[#F5E8D8]'
              : 'bg-[#FF6F61] hover:bg-[#FF4500] text-[#1C1C1C] hover:text-white font-semibold'
          }`}
          title={screenSharing ? "Stop Sharing" : "Share Screen"}
        >
          <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          <span className="text-[10px] font-medium mt-1 whitespace-nowrap hidden sm:inline">{screenSharing ? 'Stop Share' : 'Share'}</span>
        </button>

        {/* 6. WATCH TOGETHER (CO-STREAMING) */}
        <div className="relative">
          <button
            data-dropdown-trigger="watch"
            onClick={(e) => {
              e.stopPropagation();
              if (watchTogetherActive) {
                onStopWatchTogether?.();
              } else {
                setShowWatchModal(s => !s);
                setShowAudioMenu(false);
                setShowVideoMenu(false);
                setShowReactionsMenu(false);
              }
            }}
            className={`flex flex-col items-center justify-center w-9 sm:w-auto sm:min-w-[56px] h-10 sm:h-12 px-1 sm:px-2 py-1 rounded-xl transition ${
              watchTogetherActive
                ? 'bg-[#DAA520]/20 text-[#DAA520] border border-[#DAA520]/40'
                : 'hover:bg-white/[0.06] text-[#F5E8D8]'
            }`}
            title="Watch Together (Co-streaming)"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#DAA520]" />
            <span className="text-[10px] font-medium mt-1 whitespace-nowrap hidden sm:inline">
              {watchTogetherActive ? 'End' : 'Watch'}
            </span>
          </button>

          {showWatchModal && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-72 sm:w-80 rounded-2xl p2p-dropdown p-4 text-xs text-[#F5E8D8] z-50 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#F5E8D8]/10 pb-2">
                <span className="font-bold text-[#F5E8D8] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#DAA520]" /> Co-Streaming Watch Party
                </span>
                <button
                  onClick={() => setShowWatchModal(false)}
                  className="text-[#F5E8D8]/50 hover:text-[#F5E8D8]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-[#F5E8D8]/50 block">Quick Play Presets</span>
                <button
                  onClick={() => {
                    onStartWatchTogether?.("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
                    setShowWatchModal(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition text-[#F5E8D8] font-medium"
                >
                  🎬 Big Buck Bunny (HD Animation)
                </button>
                <button
                  onClick={() => {
                    onStartWatchTogether?.("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4");
                    setShowWatchModal(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition text-[#F5E8D8] font-medium"
                >
                  🚀 Tears of Steel (HD Sci-Fi)
                </button>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-[#F5E8D8]/10">
                <span className="text-[10px] font-bold uppercase text-[#F5E8D8]/50 block">Or Custom Video URL</span>
                <input
                  type="text"
                  placeholder="https://.../video.mp4"
                  value={customVideoUrl}
                  onChange={(e) => setCustomVideoUrl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#1C1C1C] border border-[#F5E8D8]/15 text-[#F5E8D8] placeholder-[#F5E8D8]/30 text-xs focus:outline-none focus:border-[#FF6F61]"
                />
                <button
                  onClick={() => {
                    if (customVideoUrl.trim()) {
                      onStartWatchTogether?.(customVideoUrl.trim());
                      setShowWatchModal(false);
                    }
                  }}
                  className="w-full py-2 rounded-xl bg-[#FF6F61] hover:bg-[#FF4500] text-[#1C1C1C] hover:text-white font-medium transition"
                >
                  Start Synced Playback
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 7. RICH GOOGLE KEYBOARD STYLE REACTIONS WITH SOUND SYNTH */}
        <div className="relative">
          <button
            data-dropdown-trigger="reactions"
            onClick={(e) => {
              e.stopPropagation();
              setShowReactionsMenu(s => !s);
              setShowAudioMenu(false);
              setShowVideoMenu(false);
              setShowWatchModal(false);
            }}
            className="flex flex-col items-center justify-center w-9 sm:w-auto sm:min-w-[56px] h-10 sm:h-12 px-1 sm:px-2 py-1 rounded-xl hover:bg-white/[0.06] text-[#F5E8D8] transition"
            title="Reactions with Audio"
          >
            <Smile className="w-4 h-4 sm:w-5 sm:h-5 text-[#DAA520]" />
            <span className="text-[10px] font-medium mt-1 whitespace-nowrap hidden sm:inline">Reactions</span>
          </button>

          {showReactionsMenu && (
            <div className="absolute bottom-16 right-0 w-72 sm:w-80 rounded-2xl p2p-dropdown p-3 z-50 animate-in fade-in zoom-in-95 shadow-2xl space-y-2.5">
              {/* Category tabs & Sound Mute Toggle */}
              <div className="flex items-center justify-between pb-2 border-b border-[#F5E8D8]/10">
                <div className="flex items-center gap-1">
                  {Object.entries(emojiCategories).map(([key, cat]) => (
                    <button
                      key={key}
                      onClick={() => setReactionCategory(key)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                        reactionCategory === key
                          ? 'bg-[#DAA520]/20 text-[#DAA520] font-semibold border border-[#DAA520]/30'
                          : 'text-[#F5E8D8]/60 hover:text-[#F5E8D8] hover:bg-white/[0.04]'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-1.5 rounded-lg transition ${
                    soundEnabled ? 'text-[#DAA520] hover:bg-white/[0.06]' : 'text-[#F5E8D8]/30 hover:bg-white/[0.06]'
                  }`}
                  title={soundEnabled ? "Emoji Sound ON" : "Emoji Sound OFF"}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Emoji Grid */}
              <div className="grid grid-cols-5 gap-1.5 py-1">
                {emojiCategories[reactionCategory].emojis.map((r) => (
                  <button
                    key={r.name}
                    onClick={() => handleTriggerEmoji(r.char)}
                    className="w-12 h-12 rounded-xl bg-white/[0.02] hover:bg-white/[0.1] flex flex-col items-center justify-center text-xl hover:scale-120 transition-all duration-150 group"
                    title={r.name}
                  >
                    <span>{r.char}</span>
                    <span className="text-[9px] text-[#F5E8D8]/40 group-hover:text-[#F5E8D8]/80 leading-none mt-0.5 scale-90 truncate max-w-[40px]">
                      {r.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-[1px] h-6 sm:h-7 bg-[#F5E8D8]/10 mx-0.5 shrink-0" />

        {/* 8. END / LEAVE BUTTON */}
        <button
          onClick={onLeaveMeeting}
          className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-[#FF4500] hover:bg-[#FF4500]/90 text-white font-semibold text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition ml-0.5 shrink-0"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isHost ? 'End' : 'Leave'}</span>
        </button>
      </div>
    )}
  </div>

      {/* C. MOBILE MORE BOTTOM SHEET */}
      {showMobileMoreSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowMobileMoreSheet(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl bg-[#242424] border-t border-[#F5E8D8]/15 shadow-2xl p-5 pb-8 z-10 animate-in slide-in-from-bottom duration-250 select-none">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#F5E8D8]">Meeting Options</h3>
                <p className="text-[11px] text-[#F5E8D8]/50">Room code: {roomCode}</p>
              </div>
              <button
                onClick={() => setShowMobileMoreSheet(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#F5E8D8]/60 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {/* Participants */}
              <button
                onClick={() => {
                  onTogglePanel('participants');
                  setShowMobileMoreSheet(false);
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/[0.04] active:bg-white/[0.1] border border-white/5 transition"
              >
                <div className="relative">
                  <Users className="w-6 h-6 text-[#FF6F61]" />
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-[#FF6F61] text-[9px] font-bold text-[#1C1C1C]">
                    {participantCount}
                  </span>
                </div>
                <span className="text-xs font-medium text-[#F5E8D8] mt-2">People</span>
              </button>

              {/* Reactions */}
              <button
                onClick={() => {
                  setShowReactionsMenu(true);
                  setShowMobileMoreSheet(false);
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/[0.04] active:bg-white/[0.1] border border-white/5 transition"
              >
                <Smile className="w-6 h-6 text-[#DAA520]" />
                <span className="text-xs font-medium text-[#F5E8D8] mt-2">Reactions</span>
              </button>

              {/* Video Filters */}
              <button
                onClick={() => {
                  setShowVideoMenu(true);
                  setShowMobileMoreSheet(false);
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/[0.04] active:bg-white/[0.1] border border-white/5 transition"
              >
                <Sparkles className="w-6 h-6 text-[#FF6F61]" />
                <span className="text-xs font-medium text-[#F5E8D8] mt-2">Filters</span>
              </button>

              {/* Watch Together */}
              <button
                onClick={() => {
                  setShowWatchModal(true);
                  setShowMobileMoreSheet(false);
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/[0.04] active:bg-white/[0.1] border border-white/5 transition"
              >
                <Clapperboard className="w-6 h-6 text-[#DAA520]" />
                <span className="text-xs font-medium text-[#F5E8D8] mt-2">Watch Party</span>
              </button>

              {/* Direct P2P File */}
              <button
                onClick={() => {
                  onTogglePanel('chat');
                  setShowMobileMoreSheet(false);
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/[0.04] active:bg-white/[0.1] border border-white/5 transition"
              >
                <FileText className="w-6 h-6 text-[#FF6F61]" />
                <span className="text-xs font-medium text-[#F5E8D8] mt-2">P2P Files</span>
              </button>

              {/* Switch Camera */}
              <button
                onClick={() => {
                  if (devices.video.length > 1) {
                    const other = devices.video.find(d => d.deviceId !== selectedCam);
                    if (other) switchCamera(other.deviceId);
                  }
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/[0.04] active:bg-white/[0.1] border border-white/5 transition"
              >
                <Sliders className="w-6 h-6 text-[#DAA520]" />
                <span className="text-xs font-medium text-[#F5E8D8] mt-2">Flip Cam</span>
              </button>
            </div>

            {/* Leave Meeting Button */}
            <button
              onClick={() => {
                setShowMobileMoreSheet(false);
                onLeaveMeeting();
              }}
              className="w-full py-3.5 rounded-2xl bg-[#FF4500] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF4500]/25 active:scale-98 transition"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{isHost ? 'End Meeting for All' : 'Leave Meeting'}</span>
            </button>
          </div>
        </div>
      )}

      {/* D. MOBILE VIDEO EFFECTS & VIRTUAL BACKGROUNDS SHEET */}
      {showVideoMenu && isMobile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowVideoMenu(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#242424] border-t sm:border border-[#F5E8D8]/15 shadow-2xl p-5 pb-8 z-10 animate-in slide-in-from-bottom duration-250 select-none max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#F5E8D8] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FF6F61]" />
                  <span>Virtual Backgrounds & Effects</span>
                </h3>
                <p className="text-[11px] text-[#F5E8D8]/50">Green screen effects & camera settings</p>
              </div>
              <button
                onClick={() => setShowVideoMenu(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#F5E8D8]/60 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#F5E8D8]">
              {/* AI Virtual Backgrounds */}
              <div>
                <span className="text-[10px] uppercase font-bold text-[#DAA520] tracking-wider block mb-2">
                  ✦ AI Virtual Backgrounds (Green Screen)
                </span>
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {filterOptions.filter(f => f.category === 'base' || f.category === 'ai').map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setVideoFilter?.(f.id);
                        setShowVideoMenu(false);
                      }}
                      className={`p-2.5 rounded-xl text-left transition border relative overflow-hidden group flex flex-col justify-between h-20 active:scale-95 ${
                        videoFilter === f.id
                          ? 'bg-[#DAA520]/25 border-[#DAA520] text-[#DAA520] shadow-md ring-1 ring-[#DAA520]'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-[#F5E8D8]'
                      }`}
                    >
                      {f.img && (
                        <div
                          className="absolute inset-0 opacity-30 transition bg-cover bg-center pointer-events-none"
                          style={{ backgroundImage: `url(${f.img})` }}
                        />
                      )}
                      <div className="relative z-10 flex items-center justify-between w-full">
                        <span className="text-xl">{f.icon}</span>
                        {videoFilter === f.id && (
                          <span className="p-0.5 rounded-full bg-[#DAA520] text-[#1C1C1C]">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div className="relative z-10">
                        <span className="text-xs font-bold block leading-tight truncate">{f.label}</span>
                        {f.desc && <span className="text-[9px] text-[#F5E8D8]/60 block leading-tight truncate mt-0.5">{f.desc}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Styles */}
              <div className="pt-2 border-t border-white/10">
                <span className="text-[10px] uppercase font-bold text-[#F5E8D8]/50 tracking-wider block mb-1.5">
                  Color Grades
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {filterOptions.filter(f => f.category === 'grade').map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setVideoFilter?.(f.id);
                        setShowVideoMenu(false);
                      }}
                      className={`px-2 py-1.5 rounded-lg text-left transition border text-[11px] font-medium flex items-center gap-1.5 ${
                        videoFilter === f.id
                          ? 'bg-[#DAA520]/20 border-[#DAA520] text-[#DAA520] font-semibold'
                          : 'bg-white/[0.03] border-transparent hover:bg-white/[0.07] text-[#F5E8D8]'
                      }`}
                    >
                      <span>{f.icon}</span>
                      <span className="truncate">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
