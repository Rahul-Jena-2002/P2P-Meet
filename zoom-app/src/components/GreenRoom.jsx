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
    <div className="relative w-screen h-screen bg-[#090b10] flex flex-col items-center justify-center p-6 overflow-hidden select-none">
      {/* Ambient glowing background orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Header */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/25">
          OM
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">OpenMeet</h1>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-400" /> Serverless Cloudflare Ready
          </span>
        </div>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center z-10">
        {/* Left: Camera & Mic Hardware Preview Box */}
        <div className="flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-[#131722] border border-white/10 shadow-2xl flex items-center justify-center">
            {videoEnabled && localStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mb-2 border border-white/5">
                  <VideoOff className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium">Camera is turned off</span>
              </div>
            )}

            {/* Notice if camera/mic restricted on HTTP */}
            {mediaError && (
              <div className="absolute top-3 left-3 right-3 p-2.5 rounded-xl bg-amber-500/90 backdrop-blur-md text-black text-xs flex items-center gap-2 shadow-lg font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-black" />
                <span className="text-[11px] leading-snug">{mediaError}</span>
              </div>
            )}

            {/* Live Audio Meter & Control Pill */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              {/* Mic volume bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs text-slate-300">
                <Volume2 className={`w-3.5 h-3.5 ${audioLevel > 10 ? 'text-emerald-400' : 'text-slate-400'}`} />
                <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75 rounded-full"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className={`p-2.5 rounded-xl backdrop-blur-md border border-white/10 transition shadow-lg ${
                    audioEnabled ? 'bg-black/60 text-white hover:bg-black/80' : 'bg-red-600 text-white shadow-red-600/30'
                  }`}
                  title={audioEnabled ? "Mute" : "Unmute"}
                >
                  {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`p-2.5 rounded-xl backdrop-blur-md border border-white/10 transition shadow-lg ${
                    videoEnabled ? 'bg-black/60 text-white hover:bg-black/80' : 'bg-red-600 text-white shadow-red-600/30'
                  }`}
                  title={videoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2.5 rounded-xl bg-black/60 hover:bg-black/80 text-white border border-white/10 transition"
                  title="Device Settings"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Device Settings Flyout */}
          {showSettings && (
            <div className="w-full mt-3 p-3 rounded-2xl zoom-panel text-xs text-slate-300 space-y-2 border border-white/10 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Camera</label>
                <select
                  value={selectedCam}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="w-full bg-[#181d29] px-2.5 py-1.5 rounded-lg border border-white/10 text-white focus:outline-none"
                >
                  {devices.video.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Camera'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Microphone</label>
                <select
                  value={selectedMic}
                  onChange={(e) => switchMicrophone(e.target.value)}
                  className="w-full bg-[#181d29] px-2.5 py-1.5 rounded-lg border border-white/10 text-white focus:outline-none"
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
          <div className="flex p-1 rounded-2xl bg-[#141724] border border-white/10 shadow-inner">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                mode === 'new' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Start New Meeting
            </button>
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                mode === 'join' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Join with Code
            </button>
          </div>

          <form onSubmit={handleStart} className="p-6 rounded-3xl zoom-panel border border-white/10 shadow-2xl space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Alex (or tap Launch to join)"
                className="w-full px-4 py-2.5 rounded-xl bg-[#181d29] border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {mode === 'new' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Meeting Topic
                </label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g. Design Sync"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#181d29] border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  6-Letter Meeting Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. X9TY4K"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#181d29] border border-white/10 text-white font-mono uppercase tracking-widest text-center text-lg font-bold placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 hover:scale-[1.01] active:scale-[0.99] transition duration-150"
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
