'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Video as VideoIcon, ArrowRight,
  Shield, Volume2, Settings2, AlertCircle
} from 'lucide-react';
import { useMedia } from './MediaProvider';
import P2PLogo from './P2PLogo';

export default function GreenRoom({ onJoinMeeting }) {
  const {
    localStream,
    audioEnabled,
    videoEnabled,
    audioLevel,
    devices,
    selectedCam,
    selectedMic,
    selectedSpeaker,
    mediaError,
    toggleAudio,
    toggleVideo,
    switchCamera,
    switchMicrophone,
    switchAudioOutput,
    testAudioOutput,
    initMedia
  } = useMedia();

  const [mode, setMode] = useState('new'); // 'new' | 'join'
  const [userName, setUserName] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('My Meeting');
  const [roomCode, setRoomCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const videoRef = useRef(null);

  // Attach live preview stream
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(e => console.warn(e));
    }
  }, [localStream, videoEnabled]);

  // Check URL query param ?code=ABC123
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        setRoomCode(code.toUpperCase());
        setMode('join');
      }
    }
  }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleStart = (e) => {
    e.preventDefault();
    const finalName = userName.trim() || (mode === 'new' ? 'Host' : 'Participant');
    const finalCode = mode === 'new' ? generateCode() : roomCode.trim().toUpperCase();

    if (!finalCode) return;

    onJoinMeeting({
      name: finalName,
      title: meetingTitle.trim() || 'Instant Meeting',
      code: finalCode,
      isHost: mode === 'new'
    });
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0D0B14] text-[#F8F7FC] flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 overflow-y-auto select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#C4B5FD]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-[#FF6B35]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between py-3 mb-2 sm:mb-6 md:absolute md:top-8 md:left-8 md:w-auto md:py-0 z-20">
        <div className="flex items-center gap-3">
          <P2PLogo size={38} />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#F8F7FC] tracking-tight">p2pmeet</h1>
            <span className="text-[11px] sm:text-xs text-[#C4B5FD] flex items-center gap-1.5 font-medium">
              <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#C4B5FD]" /> Direct Peer-to-Peer Encrypted
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center z-10 my-auto pb-6 sm:pb-0">
        {/* Left: Camera & Mic Hardware Preview Box */}
        <div className="flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-[#161324] border border-[rgba(196,181,253,0.16)] shadow-2xl flex items-center justify-center">
            {videoEnabled && localStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-[#C4B5FD]/50">
                <div className="w-20 h-20 rounded-full bg-[#0D0B14] flex items-center justify-center text-[#C4B5FD]/60 mb-2.5 border border-[rgba(196,181,253,0.14)] shadow-inner">
                  <VideoOff className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium text-[#C4B5FD]/70">Camera is turned off</span>
              </div>
            )}

            {/* Notice if camera/mic restricted on HTTP */}
            {mediaError && (
              <div className="absolute top-3 left-3 right-3 p-2.5 rounded-xl bg-[#FF6B35]/95 backdrop-blur-md text-[#0D0B14] text-xs flex items-center gap-2 shadow-lg font-semibold border border-black/10">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#0D0B14]" />
                <span className="text-[11px] leading-snug">{mediaError}</span>
              </div>
            )}

            {/* Live Audio Meter & Control Pill */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              {/* Mic volume bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0D0B14]/85 backdrop-blur-md border border-[rgba(196,181,253,0.16)] text-xs text-[#F8F7FC] shadow-md">
                <Volume2 className={`w-3.5 h-3.5 ${audioLevel > 10 ? 'text-[#FF6B35]' : 'text-[#C4B5FD]/60'}`} />
                <div className="w-16 h-1.5 bg-[rgba(196,181,253,0.15)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] transition-all duration-75 rounded-full"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className={`p-2.5 rounded-xl backdrop-blur-md border transition-all shadow-lg ${
                    audioEnabled
                      ? 'bg-[#0D0B14]/85 text-[#F8F7FC] hover:bg-[#221C35] border-[rgba(196,181,253,0.18)]'
                      : 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-[#FF6B35]/30'
                  }`}
                  title={audioEnabled ? "Mute" : "Unmute"}
                >
                  {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`p-2.5 rounded-xl backdrop-blur-md border transition-all shadow-lg ${
                    videoEnabled
                      ? 'bg-[#0D0B14]/85 text-[#F8F7FC] hover:bg-[#221C35] border-[rgba(196,181,253,0.18)]'
                      : 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-[#FF6B35]/30'
                  }`}
                  title={videoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2.5 rounded-xl bg-[#0D0B14]/85 hover:bg-[#221C35] text-[#C4B5FD] border border-[rgba(196,181,253,0.18)] transition shadow-lg"
                  title="Device Settings"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Device Settings Flyout */}
          {showSettings && (
            <div className="w-full mt-3 p-3.5 rounded-2xl bg-[#221C35] text-xs text-[#F8F7FC] space-y-2.5 border border-[rgba(196,181,253,0.18)] shadow-2xl animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#C4B5FD] block mb-1 tracking-wider">Camera</label>
                <select
                  value={selectedCam}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="w-full bg-[#0D0B14] px-3 py-1.5 rounded-lg border border-[rgba(196,181,253,0.20)] text-[#F8F7FC] focus:outline-none focus:border-[#FF6B35]"
                >
                  {devices.video.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Camera'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#C4B5FD] block mb-1 tracking-wider">Microphone</label>
                <select
                  value={selectedMic}
                  onChange={(e) => switchMicrophone(e.target.value)}
                  className="w-full bg-[#0D0B14] px-3 py-1.5 rounded-lg border border-[rgba(196,181,253,0.20)] text-[#F8F7FC] focus:outline-none focus:border-[#FF6B35]"
                >
                  {devices.audio.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Microphone'}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-bold text-[#C4B5FD] tracking-wider">Speaker (Sound Output)</label>
                  <button
                    type="button"
                    onClick={() => testAudioOutput(selectedSpeaker)}
                    className="text-[10px] text-[#FFA14A] hover:underline"
                  >
                    Test Sound
                  </button>
                </div>
                <select
                  value={selectedSpeaker}
                  onChange={(e) => switchAudioOutput(e.target.value)}
                  className="w-full bg-[#0D0B14] px-3 py-1.5 rounded-lg border border-[rgba(196,181,253,0.20)] text-[#F8F7FC] focus:outline-none focus:border-[#FFA14A]"
                >
                  {devices.audioOutput && devices.audioOutput.length > 0 ? (
                    devices.audioOutput.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Speaker'}</option>
                    ))
                  ) : (
                    <option value="default">Default System Audio Output</option>
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Right: Join / Create Meeting Form */}
        <div className="flex flex-col space-y-5">
          <div className="flex p-1 rounded-2xl bg-[#161324] border border-[rgba(196,181,253,0.14)] shadow-inner">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                mode === 'new'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold shadow-md shadow-[#FF6B35]/25'
                  : 'text-[#C4B5FD]/70 hover:text-[#F8F7FC]'
              }`}
            >
              Start New Meeting
            </button>
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                mode === 'join'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] text-[#0D0B14] font-bold shadow-md shadow-[#FF6B35]/25'
                  : 'text-[#C4B5FD]/70 hover:text-[#F8F7FC]'
              }`}
            >
              Join with Code
            </button>
          </div>

          <form onSubmit={handleStart} className="p-7 rounded-3xl bg-[#161324] border border-[rgba(196,181,253,0.14)] shadow-2xl space-y-4.5">
            <div>
              <label className="block text-xs font-semibold text-[#C4B5FD] mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Alex (or tap Launch to join)"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0B14] border border-[rgba(196,181,253,0.18)] text-[#F8F7FC] text-sm placeholder-[#C4B5FD]/35 focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition"
              />
            </div>

            {mode === 'new' ? (
              <div>
                <label className="block text-xs font-semibold text-[#C4B5FD] mb-1.5">
                  Meeting Topic
                </label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Design Sync"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0D0B14] border border-[rgba(196,181,253,0.18)] text-[#F8F7FC] text-sm placeholder-[#C4B5FD]/35 focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#C4B5FD] mb-1.5">
                  6-Letter Meeting Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. X9TY4K"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0D0B14] border border-[rgba(196,181,253,0.18)] text-[#F8F7FC] font-mono uppercase tracking-widest text-center text-lg font-bold placeholder-[#C4B5FD]/35 focus:outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/30 transition"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] hover:brightness-110 text-[#0D0B14] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B35]/25 transition duration-150"
            >
              <span>{mode === 'new' ? 'Launch Meeting' : 'Join Call'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
