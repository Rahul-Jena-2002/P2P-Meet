'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Video as VideoIcon, ArrowRight,
  Shield, Sparkles, Volume2, Settings2, ChevronDown, Check, AlertCircle
} from 'lucide-react';
import { useMedia } from './MediaProvider';

export default function GreenRoom({ onJoinMeeting }) {
  const {
    localStream,
    audioEnabled,
    videoEnabled,
    audioLevel,
    devices,
    selectedCam,
    selectedMic,
    mediaError,
    toggleAudio,
    toggleVideo,
    switchCamera,
    switchMicrophone,
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
    <div className="relative w-screen h-screen bg-[#1C1C1C] text-[#F5E8D8] flex flex-col items-center justify-center p-6 overflow-hidden select-none">
      {/* Header */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FF6F61] flex items-center justify-center text-[#1C1C1C] font-bold text-xs tracking-wider border border-[#F5E8D8]/10">
          P2P
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#F5E8D8] tracking-tight">p2pmeet</h1>
          <span className="text-xs text-[#F5E8D8]/60 flex items-center gap-1.5 font-medium">
            <Shield className="w-3.5 h-3.5 text-[#DAA520]" /> Direct Peer-to-Peer Encrypted
          </span>
        </div>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center z-10">
        {/* Left: Camera & Mic Hardware Preview Box */}
        <div className="flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-[#242424] border border-[#F5E8D8]/10 shadow-2xl flex items-center justify-center">
            {videoEnabled && localStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-[#F5E8D8]/50">
                <div className="w-20 h-20 rounded-full bg-[#1C1C1C] flex items-center justify-center text-[#F5E8D8]/40 mb-2.5 border border-[#F5E8D8]/10 shadow-inner">
                  <VideoOff className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium text-[#F5E8D8]/60">Camera is turned off</span>
              </div>
            )}

            {/* Notice if camera/mic restricted on HTTP */}
            {mediaError && (
              <div className="absolute top-3 left-3 right-3 p-2.5 rounded-xl bg-[#DAA520]/95 backdrop-blur-md text-[#1C1C1C] text-xs flex items-center gap-2 shadow-lg font-semibold border border-black/10">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#1C1C1C]" />
                <span className="text-[11px] leading-snug">{mediaError}</span>
              </div>
            )}

            {/* Live Audio Meter & Control Pill */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              {/* Mic volume bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1C1C1C]/80 backdrop-blur-md border border-[#F5E8D8]/10 text-xs text-[#F5E8D8]/80 shadow-md">
                <Volume2 className={`w-3.5 h-3.5 ${audioLevel > 10 ? 'text-[#DAA520]' : 'text-[#F5E8D8]/40'}`} />
                <div className="w-16 h-1.5 bg-[#F5E8D8]/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#DAA520] transition-all duration-75 rounded-full"
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
                      ? 'bg-[#1C1C1C]/80 text-[#F5E8D8] hover:bg-[#1C1C1C] border-[#F5E8D8]/15'
                      : 'bg-[#FF4500] text-[#F5E8D8] border-[#FF4500] shadow-[#FF4500]/30'
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
                      ? 'bg-[#1C1C1C]/80 text-[#F5E8D8] hover:bg-[#1C1C1C] border-[#F5E8D8]/15'
                      : 'bg-[#FF4500] text-[#F5E8D8] border-[#FF4500] shadow-[#FF4500]/30'
                  }`}
                  title={videoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2.5 rounded-xl bg-[#1C1C1C]/80 hover:bg-[#1C1C1C] text-[#F5E8D8] border border-[#F5E8D8]/15 transition shadow-lg"
                  title="Device Settings"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Device Settings Flyout */}
          {showSettings && (
            <div className="w-full mt-3 p-3.5 rounded-2xl bg-[#242424] text-xs text-[#F5E8D8] space-y-2.5 border border-[#F5E8D8]/12 shadow-2xl animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#F5E8D8]/50 block mb-1 tracking-wider">Camera</label>
                <select
                  value={selectedCam}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="w-full bg-[#1C1C1C] px-3 py-1.5 rounded-lg border border-[#F5E8D8]/15 text-[#F5E8D8] focus:outline-none focus:border-[#FF6F61]"
                >
                  {devices.video.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Camera'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#F5E8D8]/50 block mb-1 tracking-wider">Microphone</label>
                <select
                  value={selectedMic}
                  onChange={(e) => switchMicrophone(e.target.value)}
                  className="w-full bg-[#1C1C1C] px-3 py-1.5 rounded-lg border border-[#F5E8D8]/15 text-[#F5E8D8] focus:outline-none focus:border-[#FF6F61]"
                >
                  {devices.audio.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Microphone'}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Right: Join / Create Meeting Form */}
        <div className="flex flex-col space-y-5">
          <div className="flex p-1 rounded-2xl bg-[#242424] border border-[#F5E8D8]/10 shadow-inner">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                mode === 'new'
                  ? 'bg-[#FF6F61] text-[#1C1C1C] font-bold shadow-md shadow-[#FF6F61]/25'
                  : 'text-[#F5E8D8]/60 hover:text-[#F5E8D8]'
              }`}
            >
              Start New Meeting
            </button>
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                mode === 'join'
                  ? 'bg-[#FF6F61] text-[#1C1C1C] font-bold shadow-md shadow-[#FF6F61]/25'
                  : 'text-[#F5E8D8]/60 hover:text-[#F5E8D8]'
              }`}
            >
              Join with Code
            </button>
          </div>

          <form onSubmit={handleStart} className="p-7 rounded-3xl bg-[#242424] border border-[#F5E8D8]/10 shadow-2xl space-y-4.5">
            <div>
              <label className="block text-xs font-semibold text-[#F5E8D8]/80 mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Alex (or tap Launch to join)"
                className="w-full px-4 py-2.5 rounded-xl bg-[#1C1C1C] border border-[#F5E8D8]/15 text-[#F5E8D8] text-sm placeholder-[#F5E8D8]/30 focus:outline-none focus:border-[#FF6F61] focus:ring-1 focus:ring-[#FF6F61]/30 transition"
              />
            </div>

            {mode === 'new' ? (
              <div>
                <label className="block text-xs font-semibold text-[#F5E8D8]/80 mb-1.5">
                  Meeting Topic
                </label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Design Sync"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1C1C1C] border border-[#F5E8D8]/15 text-[#F5E8D8] text-sm placeholder-[#F5E8D8]/30 focus:outline-none focus:border-[#FF6F61] focus:ring-1 focus:ring-[#FF6F61]/30 transition"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#F5E8D8]/80 mb-1.5">
                  6-Letter Meeting Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. X9TY4K"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1C1C1C] border border-[#F5E8D8]/15 text-[#F5E8D8] font-mono uppercase tracking-widest text-center text-lg font-bold placeholder-[#F5E8D8]/30 focus:outline-none focus:border-[#FF6F61] focus:ring-1 focus:ring-[#FF6F61]/30 transition"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#FF6F61] hover:bg-[#FF4500] text-[#1C1C1C] hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition duration-150"
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
