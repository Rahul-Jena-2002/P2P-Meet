'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Mic, MicOff, Settings2, Shield, Video, VideoOff, Volume2 } from 'lucide-react';
import { useMedia } from './MediaProvider';
import P2PLogo from './P2PLogo';

export default function MobileGreenRoom({ onJoinMeeting }) {
  const { localStream, audioEnabled, videoEnabled, audioLevel, devices, selectedCam, selectedMic, selectedSpeaker, mediaError, toggleAudio, toggleVideo, switchCamera, switchMicrophone, switchAudioOutput, testAudioOutput } = useMedia();
  const [mode, setMode] = useState('new');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedCode = params.get('code');
    if (linkedCode) {
      setCode(linkedCode.toUpperCase());
      setName(params.get('name') || '');
      setMode(params.get('host') === '1' ? 'new' : 'join');
    }
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const generated = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const params = new URLSearchParams(window.location.search);
    const linkedHostRoom = params.get('host') === '1' && params.get('code');
    const meetingCode = linkedHostRoom ? params.get('code').trim().toUpperCase() : mode === 'new' ? generated : code.trim().toUpperCase();
    if (!meetingCode) return;
    onJoinMeeting({ code: meetingCode, title: 'Instant Meeting', name: name.trim() || (mode === 'new' ? 'Host' : 'Participant'), isHost: mode === 'new' });
  };

  return (
    <div className="mobile-lobby">
      <header className="mobile-lobby-header">
        <div className="mobile-lobby-brand"><P2PLogo size={42} /><div><h1>p2pmeet</h1><p><Shield size={13} /> Ready when you are</p></div></div>
      </header>

      <section className="mobile-lobby-preview" aria-label="Camera preview">
        {videoEnabled && localStream ? <video ref={videoRef} autoPlay playsInline muted className="mobile-lobby-video" /> : <div className="mobile-lobby-off"><VideoOff size={42} /><span>Camera is off</span></div>}
        {mediaError && <div className="mobile-lobby-error"><AlertCircle size={15} />{mediaError}</div>}
        <span className="mobile-lobby-status"><i className={videoEnabled && localStream ? 'live' : ''} />{videoEnabled && localStream ? 'Camera on' : 'Camera off'}</span>
        <div className="mobile-lobby-preview-controls">
          <div className="mobile-lobby-meter"><Volume2 size={15} /><span><b style={{ width: `${audioLevel}%` }} /></span></div>
          <button type="button" onClick={toggleAudio} aria-label={audioEnabled ? 'Mute microphone' : 'Turn on microphone'} className={!audioEnabled ? 'off' : ''}>{audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}</button>
          <button type="button" onClick={toggleVideo} aria-label={videoEnabled ? 'Turn off camera' : 'Turn on camera'} className={!videoEnabled ? 'off' : ''}>{videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}</button>
          <button type="button" onClick={() => setSettingsOpen(v => !v)} aria-label="Device settings"><Settings2 size={18} /></button>
        </div>
      </section>

      {settingsOpen && <section className="mobile-lobby-settings">
        <label>Camera<select value={selectedCam} onChange={e => switchCamera(e.target.value)}>{devices.video.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default camera'}</option>)}</select></label>
        <label>Microphone<select value={selectedMic} onChange={e => switchMicrophone(e.target.value)}>{devices.audio.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default microphone'}</option>)}</select></label>
        <label>Speaker<select value={selectedSpeaker} onChange={e => switchAudioOutput(e.target.value)}>{(devices.audioOutput || []).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default speaker'}</option>)}</select><button type="button" onClick={() => testAudioOutput(selectedSpeaker)}>Test sound</button></label>
      </section>}

      <section className="mobile-lobby-join-panel" aria-label="Start or join a meeting">
        <div className="mobile-lobby-mode"><button type="button" className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>New meeting</button><button type="button" className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Join with code</button></div>
        <form className="mobile-lobby-form" onSubmit={submit}>
          <label><span className="mobile-lobby-label-row">Your name <span className="mobile-lobby-optional">· optional</span></span><input value={name} onChange={e => setName(e.target.value)} placeholder="Name shown in the meeting" autoComplete="name" /></label>
          {mode === 'join' && <label>Meeting code<input required maxLength={12} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Enter meeting code" autoCapitalize="characters" autoCorrect="off" /></label>}
          <button type="submit">{mode === 'new' ? 'Start a meeting' : 'Join meeting'} <ArrowRight size={19} /></button>
        </form>
      </section>
    </div>
  );
}
