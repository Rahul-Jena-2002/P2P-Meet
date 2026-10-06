/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Video, Users, Plus, ArrowRight, Mic, MicOff, VideoOff,
  Shield, Laptop, Sparkles, AlertCircle
} from 'lucide-react';
import { useMeetingStore } from '../webrtc/useMeetingStore';
import { webrtcManager } from '../webrtc/WebRtcManager';

export default function LandingPage() {
  const { setMeetingData, setLocalStream } = useMeetingStore();

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'join'
  const [hostName, setHostName] = useState('Host');
  const [meetingTitle, setMeetingTitle] = useState('Quick Sync');
  const [joinCode, setJoinCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [previewMic, setPreviewMic] = useState(true);
  const [previewCam, setPreviewCam] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoPreviewRef = useRef(null);
  const previewStreamRef = useRef(null);

  // Parse code from URL query param if present (?code=ABC123)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    if (codeParam) {
      setJoinCode(codeParam.toUpperCase());
      setActiveTab('join');
    }
  }, []);

  // Set up local camera preview
  useEffect(() => {
    let active = true;

    async function initPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        previewStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Could not acquire media devices for preview:', err);
      }
    }

    initPreview();

    return () => {
      active = false;
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const togglePreviewMic = () => {
    if (previewStreamRef.current) {
      const next = !previewMic;
      previewStreamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
      setPreviewMic(next);
    }
  };

  const togglePreviewCam = () => {
    if (previewStreamRef.current) {
      const next = !previewCam;
      previewStreamRef.current.getVideoTracks().forEach(t => { t.enabled = next; });
      setPreviewCam(next);
    }
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('http://localhost:8080/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingTitle.trim() || 'Instant Meeting',
          hostName: hostName.trim() || 'Host'
        })
      });

      if (!res.ok) throw new Error('Failed to create meeting');
      const data = await res.json();

      // Fetch ICE servers
      const iceRes = await fetch(`http://localhost:8080/api/meetings/${data.code}/ice-servers`);
      const iceData = await iceRes.json();

      // Hand over preview stream to meeting store
      const localStream = previewStreamRef.current || await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(localStream);

      const localUser = {
        participantId: data.hostId,
        displayName: data.hostName,
        isHost: true,
        audioEnabled: previewMic,
        videoEnabled: previewCam,
        screenSharing: false
      };

      setMeetingData(
        { meetingId: data.meetingId, code: data.code, title: data.title },
        data.token,
        localUser
      );

      await webrtcManager.initialize({
        roomId: data.code,
        token: data.token,
        localUser,
        iceServers: iceData.iceServers
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('Could not connect to backend server. Make sure the Spring Boot backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinMeeting = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsLoading(true);
    setErrorMsg('');

    const code = joinCode.trim().toUpperCase();

    try {
      const res = await fetch(`http://localhost:8080/api/meetings/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: participantName.trim() || 'Guest'
        })
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error('Meeting not found with this code');
        throw new Error('Could not join meeting');
      }

      const data = await res.json();

      // Fetch ICE servers
      const iceRes = await fetch(`http://localhost:8080/api/meetings/${code}/ice-servers`);
      const iceData = await iceRes.json();

      const localStream = previewStreamRef.current || await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(localStream);

      const localUser = {
        participantId: data.participantId,
        displayName: data.displayName,
        isHost: false,
        audioEnabled: previewMic,
        videoEnabled: previewCam,
        screenSharing: false
      };

      setMeetingData(
        { meetingId: data.meetingId, code: data.code, title: data.title },
        data.token,
        localUser
      );

      await webrtcManager.initialize({
        roomId: data.code,
        token: data.token,
        localUser,
        iceServers: iceData.iceServers
      });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to join meeting');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-dark-900 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Navbar */}
      <header className="px-8 py-5 flex items-center justify-between border-b border-slate-800/80 glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-500/30">
            OM
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              OpenMeet
            </span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
              P2P Mesh
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Zero Data Storage</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Laptop className="w-4 h-4 text-cyan-400" />
            <span>Remote Desktop Ready</span>
          </div>
        </div>
      </header>

      {/* Hero Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col lg:flex-row items-center gap-12 justify-center">
        {/* Left Side: Setup & Forms */}
        <div className="flex-1 max-w-lg w-full space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Self-Hostable Video Collaboration
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              Instant meetings.<br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Direct peer-to-peer.
              </span>
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              No accounts needed. Video, audio, chat, screen sharing, and remote desktop control straight from your browser.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex p-1 rounded-2xl bg-dark-800 border border-slate-800 shadow-inner">
            <button
              onClick={() => { setActiveTab('new'); setErrorMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'new'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              New Meeting
            </button>
            <button
              onClick={() => { setActiveTab('join'); setErrorMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'join'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Join with Code
            </button>
          </div>

          {/* Form Card */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-800/90 shadow-2xl space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {activeTab === 'new' ? (
              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="e.g. Alice"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="e.g. Design Review"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isLoading ? 'Creating Room...' : 'Start Meeting Now'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinMeeting} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Meeting Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB34EF"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white font-mono uppercase tracking-widest placeholder-slate-500 text-base font-bold focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="e.g. Bob"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !joinCode}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition disabled:opacity-50"
                >
                  <span>{isLoading ? 'Connecting...' : 'Join Meeting'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Side: Camera & Mic Hardware Preview */}
        <div className="flex-1 max-w-md w-full flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-dark-800 border border-slate-800 shadow-2xl flex items-center justify-center">
            {previewCam ? (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                  <VideoOff className="w-8 h-8" />
                </div>
                <span className="text-xs text-slate-400">Camera is off</span>
              </div>
            )}

            {/* Quick Preview Toggles */}
            <div className="absolute bottom-4 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePreviewMic}
                className={`p-3 rounded-2xl backdrop-blur-md transition shadow-lg ${
                  previewMic
                    ? 'bg-slate-900/80 text-white hover:bg-slate-800 border border-white/10'
                    : 'bg-red-500 text-white shadow-red-500/30'
                }`}
                title={previewMic ? "Mute Microphone" : "Unmute Microphone"}
              >
                {previewMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={togglePreviewCam}
                className={`p-3 rounded-2xl backdrop-blur-md transition shadow-lg ${
                  previewCam
                    ? 'bg-slate-900/80 text-white hover:bg-slate-800 border border-white/10'
                    : 'bg-red-500 text-white shadow-red-500/30'
                }`}
                title={previewCam ? "Turn Camera Off" : "Turn Camera On"}
              >
                {previewCam ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <span className="mt-3 text-xs text-slate-500">Device preview before joining</span>
        </div>
      </main>
    </div>
  );
}
