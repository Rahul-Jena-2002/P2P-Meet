'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import { useMedia } from './MediaProvider';
import { P2PMesh } from '../lib/p2pMesh';
import P2PHeader from './P2PHeader';
import P2PGrid from './P2PGrid';
import P2PControls from './P2PControls';
import P2PChatDrawer from './P2PChatDrawer';
import P2PParticipantsDrawer from './P2PParticipantsDrawer';
import P2PWhiteboard from './P2PWhiteboard';
import { soundSynth } from '../lib/soundEffects';

export default function P2PMeetingRoom({ meetingInfo, onLeave }) {
  const {
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    screenSharing,
    audioLevel
  } = useMedia();

  const [peers, setPeers] = useState({});
  const [messages, setMessages] = useState([]);
  const [currentUserName, setCurrentUserName] = useState(meetingInfo.name);
  const [activePanel, setActivePanel] = useState(null); // 'chat' | 'participants' | 'watch'
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'speaker'
  const [reactions, setReactions] = useState([]);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [screenAudioStreams, setScreenAudioStreams] = useState(new Map());
  const [topologyMode, setTopologyMode] = useState('mesh');
  const [isSupernode, setIsSupernode] = useState(false);
  const hideTimeoutRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
      const isLand = (h < 550 && w < 1024) || (isTouch && h < 600 && w > h);
      setIsMobileLandscape(isLand);
      setIsMobile(w < 768 || isLand || (isTouch && w < 1024));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const resetHideTimer = () => {
    setControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (!activePanel) {
      hideTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  };

  const handleStageClick = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.p2p-dock') || e.target.closest('.p2p-panel')) return;
    setControlsVisible(v => !v);
  };

  const spawnReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 80) + 10;
    setReactions(r => [...r, { id, emoji, left }]);
    setTimeout(() => {
      setReactions(r => r.filter(item => item.id !== id));
    }, 2800);
  };

  useEffect(() => {
    const handleActivity = () => resetHideTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity, { passive: true });
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [activePanel, isMobile]);

  // Remote Access state
  const [remoteControlState, setRemoteControlState] = useState({
    isControlling: false,
    isBeingControlled: false,
    controllerName: null,
    requestPending: false,
    requesterId: null,
    requesterName: null
  });
  const [remoteCursor, setRemoteCursor] = useState(null);
  const [remoteRipples, setRemoteRipples] = useState([]);

  // Watch Together state
  const [watchTogetherState, setWatchTogetherState] = useState({
    active: false,
    url: '',
    isPlaying: false,
    currentTime: 0
  });

  // Network quality & adaptive bitrate state
  const [networkStats, setNetworkStats] = useState({ quality: 'excellent', rtt: 35, lossRate: 0, scaleFactor: 1.0 });

  // Authentic Zoom feature states
  const [raisedHands, setRaisedHands] = useState([]); // user IDs with hands raised
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const [incomingWhiteboardStroke, setIncomingWhiteboardStroke] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    lockMeeting: false,
    allowScreenShare: true,
    allowChat: true,
    allowRename: true,
    allowUnmute: true
  });
  const [userRoles, setUserRoles] = useState({}); // userId -> 'host' | 'co-host' | 'participant'
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Multi-Speaker Active Voice Tracking (Detects simultaneous speakers across local mic & all remote peers)
  const [speakingUserIds, setSpeakingUserIds] = useState([]);
  const remoteAnalysersRef = useRef(new Map()); // peerId -> { analyser, source, ctx }

  useEffect(() => {
    // Synchronize remote stream audio analysers
    const peerEntries = Object.entries(peers);
    const activePeerIds = new Set(peerEntries.map(([id]) => id));

    // Cleanup disconnected peers
    for (const [id, node] of remoteAnalysersRef.current.entries()) {
      if (!activePeerIds.has(id)) {
        try {
          node.source?.disconnect();
          node.ctx?.close().catch(() => {});
        } catch (_) {}
        remoteAnalysersRef.current.delete(id);
      }
    }

    // Attach analysers for peers with audio tracks
    peerEntries.forEach(([peerId, peer]) => {
      if (peer.stream && peer.isAudioOn !== false) {
        const audioTracks = peer.stream.getAudioTracks();
        if (audioTracks.length > 0 && !remoteAnalysersRef.current.has(peerId)) {
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
              const ctx = new AudioContext();
              const source = ctx.createMediaStreamSource(peer.stream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 64;
              source.connect(analyser); // Analyser only, no feedback destination
              remoteAnalysersRef.current.set(peerId, { analyser, source, ctx });
            }
          } catch (e) {
            console.warn('[Audio] Failed to bind remote analyser:', e);
          }
        }
      }
    });
  }, [peers]);

  // Periodic multi-speaker volume check
  useEffect(() => {
    const dataBuffer = new Uint8Array(32);
    const interval = setInterval(() => {
      const activeSpeakers = [];

      // 1. Local user speaking?
      if (audioEnabled && audioLevel > 18) {
        activeSpeakers.push(meetingInfo.userId);
      }

      // 2. Any remote peers speaking simultaneously?
      for (const [peerId, { analyser }] of remoteAnalysersRef.current.entries()) {
        try {
          analyser.getByteFrequencyData(dataBuffer);
          let sum = 0;
          for (let i = 0; i < dataBuffer.length; i++) {
            sum += dataBuffer[i];
          }
          const avg = sum / dataBuffer.length;
          if (avg > 14) {
            activeSpeakers.push(peerId);
          }
        } catch (_) {}
      }

      setSpeakingUserIds(activeSpeakers);
    }, 120);

    return () => {
      clearInterval(interval);
    };
  }, [audioEnabled, audioLevel, meetingInfo.userId]);

  const meshRef = useRef(null);

  useEffect(() => {
    const mesh = new P2PMesh({
      roomId: meetingInfo.code,
      userId: meetingInfo.userId,
      userName: meetingInfo.name,
      stream: localStream,
      onNetworkStats: (stats) => {
        setNetworkStats(stats);
      },
      onPeerJoin: (peerId, name) => {
        setPeers(prev => ({
          ...prev,
          [peerId]: {
            ...(prev[peerId] || {}),
            id: peerId,
            name: name || prev[peerId]?.name || 'Participant',
            stream: prev[peerId]?.stream || null,
            screenStream: prev[peerId]?.screenStream || null,
            isHost: peerId.startsWith('host-') || prev[peerId]?.isHost || false,
            isAudioOn: prev[peerId]?.isAudioOn ?? true,
            isVideoOn: prev[peerId]?.isVideoOn ?? true,
            isScreenSharing: prev[peerId]?.isScreenSharing ?? false
          }
        }));
        if (securitySettings.lockMeeting && meetingInfo.isHost) {
          meshRef.current?.broadcast({
            type: 'ROOM_LOCKED_NOTICE',
            targetId: peerId
          });
          return;
        }
        // Notify new joiner of current state
        meshRef.current?.broadcast({
          type: 'PEER_MEDIA_STATE',
          userId: meetingInfo.userId,
          userName: meetingInfo.name,
          isHost: meetingInfo.isHost,
          isScreenSharing: screenSharing,
          screenTrackId: screenStream?.getVideoTracks()[0]?.id || null,
          cameraTrackId: localStream?.getVideoTracks()[0]?.id || null,
          isVideoOn: videoEnabled,
          isAudioOn: audioEnabled
        });
      },
      onPeerLeave: (peerId) => {
        const isHostLeaving = peerId.startsWith('host-') || peers[peerId]?.isHost;
        setPeers(prev => {
          const updated = { ...prev };
          delete updated[peerId];
          return updated;
        });
        if (remoteControlState.requesterId === peerId || remoteControlState.isBeingControlled) {
          setRemoteControlState({
            isControlling: false,
            isBeingControlled: false,
            controllerName: null,
            requestPending: false,
            requesterId: null,
            requesterName: null
          });
        }
        // If the host left, end the meeting automatically for all participants
        if (isHostLeaving && !meetingInfo.isHost) {
          try {
            sessionStorage.removeItem('p2pmeet_session');
          } catch (_) {}
          alert('The host has left or disconnected. The meeting has ended.');
          onLeave();
        }
      },
      onStream: (peerId, remoteStream, name) => {
        setPeers(prev => ({
          ...prev,
          [peerId]: {
            ...(prev[peerId] || {}),
            id: peerId,
            name: name || prev[peerId]?.name || 'Participant',
            stream: remoteStream
          }
        }));
      },
      onScreenStream: (peerId, remoteScreenStream) => {
        setPeers(prev => ({
          ...prev,
          [peerId]: {
            ...(prev[peerId] || {}),
            id: peerId,
            screenStream: remoteScreenStream,
            isScreenSharing: !!remoteScreenStream
          }
        }));
      },
      onScreenAudioStream: (peerId, remoteScreenAudioStream) => {
        setScreenAudioStreams(prev => {
          const next = new Map(prev);
          if (remoteScreenAudioStream) {
            next.set(peerId, remoteScreenAudioStream);
          } else {
            next.delete(peerId);
          }
          return next;
        });
      },
      onData: (data) => {
        const { type } = data;

        if (type === 'chat') {
          setMessages(m => [...m, data.payload || data]);
        } else if (type === 'reaction') {
          const emoji = data.payload?.emoji || data.emoji;
          spawnReaction(emoji);
          soundSynth.playEmojiSound(emoji);
        } else if (type === 'PEER_MEDIA_STATE') {
          const targetId = data.userId || data.senderId;
          if (targetId) {
            if (data.screenTrackId) {
              meshRef.current?.setPeerScreenTrack?.(targetId, data.screenTrackId);
            }
            setPeers(prev => ({
              ...prev,
              [targetId]: {
                ...(prev[targetId] || {}),
                id: targetId,
                name: data.userName || data.senderName || prev[targetId]?.name || 'Participant',
                isHost: data.isHost !== undefined ? data.isHost : (targetId.startsWith('host-') || prev[targetId]?.isHost || false),
                isScreenSharing: !!data.isScreenSharing,
                screenStream: data.isScreenSharing ? prev[targetId]?.screenStream : null,
                isVideoOn: data.isVideoOn !== false,
                isAudioOn: data.isAudioOn !== false
              }
            }));
          }
        } else if (type === 'REMOTE_REQ') {
          setRemoteControlState(s => ({
            ...s,
            requestPending: true,
            requesterId: data.requesterId,
            requesterName: data.requesterName
          }));
        } else if (type === 'REMOTE_RES') {
          if (data.allowed && (!data.targetId || data.targetId === meetingInfo.userId)) {
            setRemoteControlState(s => ({ ...s, isControlling: true }));
          } else if (!data.allowed) {
            alert('Remote control request was declined.');
          }
        } else if (type === 'REMOTE_REVOKE') {
          setRemoteControlState({
            isControlling: false,
            isBeingControlled: false,
            controllerName: null,
            requestPending: false,
            requesterId: null,
            requesterName: null
          });
          setRemoteCursor(null);
        } else if (type === 'REMOTE_MOUSE') {
          setRemoteCursor({ x: data.x, y: data.y, name: data.name });
          if (data.click) {
            const ripId = Date.now() + Math.random();
            setRemoteRipples(r => [...r, { id: ripId, x: data.x, y: data.y }]);
            setTimeout(() => {
              setRemoteRipples(r => r.filter(item => item.id !== ripId));
            }, 800);
          }
        } else if (type === 'WATCH_START') {
          setWatchTogetherState({ active: true, url: data.url, isPlaying: true, currentTime: 0 });
        } else if (type === 'WATCH_SYNC') {
          setWatchTogetherState(prev => ({ ...prev, ...data.sync }));
        } else if (type === 'WATCH_STOP') {
          setWatchTogetherState({ active: false, url: '', isPlaying: false, currentTime: 0 });
        } else if (type === 'HAND_RAISE') {
          const targetId = data.userId;
          if (data.raised) {
            setRaisedHands(prev => prev.includes(targetId) ? prev : [...prev, targetId]);
          } else {
            setRaisedHands(prev => prev.filter(id => id !== targetId));
          }
        } else if (type === 'HAND_LOWER') {
          setRaisedHands(prev => prev.filter(id => id !== data.userId));
        } else if (type === 'MUTE_ALL') {
          if (!meetingInfo.isHost) {
            toggleAudio();
            alert('The host has muted all participants.');
          }
        } else if (type === 'SECURITY_UPDATE') {
          setSecuritySettings(prev => ({ ...prev, ...data.settings }));
        } else if (type === 'WHITEBOARD_STROKE') {
          setIncomingWhiteboardStroke(data.stroke);
          setWhiteboardActive(true);
        } else if (type === 'RENAME_USER') {
          setPeers(prev => ({
            ...prev,
            [data.userId]: { ...prev[data.userId], name: data.newName }
          }));
        } else if (type === 'ROLE_UPDATE') {
          setUserRoles(prev => ({ ...prev, [data.targetId]: data.newRole }));
        } else if (type === 'KICK_USER' && data.targetId === meetingInfo.userId) {
          alert('You have been removed from the meeting by the host.');
          handleLeaveMeeting(false);
        } else if (type === 'ROOM_LOCKED_NOTICE' && data.targetId === meetingInfo.userId) {
          alert('This meeting has been locked by the host.');
          handleLeaveMeeting(false);
        } else if (type === 'MEETING_ENDED') {
          try {
            sessionStorage.removeItem('p2pmeet_session');
          } catch (_) {}
          alert('The host has ended the meeting for all participants.');
          onLeave();
        }
      }
    });

    meshRef.current = mesh;
    mesh.connect();

    mesh.topology?.on?.('modeChanged', ({ mode }) => setTopologyMode(mode));
    const checkTopology = () => {
      if (mesh.topology) {
        setTopologyMode(mesh.topology.getMode());
        const bestPeer = mesh.topology.relaySelector?.selectBestRelayCandidate?.();
        setIsSupernode(bestPeer?.id === meetingInfo.userId);
      }
    };
    const topoTimer = setInterval(checkTopology, 2500);

    return () => {
      clearInterval(topoTimer);
      mesh.destroy();
    };
  }, [meetingInfo.code, meetingInfo.userId]);

  // Update stream and broadcast state when screen share or camera changes
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.replaceStream({
        localStream,
        screenStream: screenSharing ? screenStream : null
      });
      meshRef.current.broadcast({
        type: 'PEER_MEDIA_STATE',
        userId: meetingInfo.userId,
        userName: currentUserName,
        isScreenSharing: screenSharing,
        screenTrackId: screenStream?.getVideoTracks()[0]?.id || null,
        cameraTrackId: localStream?.getVideoTracks()[0]?.id || null,
        isVideoOn: videoEnabled,
        isAudioOn: audioEnabled
      });
    }
  }, [localStream, screenStream, screenSharing, videoEnabled, audioEnabled, currentUserName]);

  // Keep mic mute state synced into the WebAudio mixer when screen share + system audio is active
  useEffect(() => {
    if (screenSharing && screenStream?.getAudioTracks().length > 0 && meshRef.current) {
      meshRef.current.setMixerMicMuted?.(!audioEnabled);
    }
  }, [audioEnabled, screenSharing, screenStream]);

  const handleSendReaction = (emoji) => {
    spawnReaction(emoji);
    meshRef.current?.broadcast({
      type: 'reaction',
      payload: { emoji, senderId: meetingInfo.userId }
    });
  };

  const handleSendMessage = (messagePayload) => {
    const isObj = typeof messagePayload === 'object';
    const msg = {
      senderId: meetingInfo.userId,
      senderName: meetingInfo.name,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...(isObj ? messagePayload : { type: 'text', text: messagePayload })
    };
    setMessages(m => [...m, msg]);
    meshRef.current?.broadcast({
      type: 'chat',
      payload: msg
    });
  };

  // Remote Control Handlers (Zoom + RemoteDesk style)
  const handleRequestRemoteControl = () => {
    meshRef.current?.broadcast({
      type: 'REMOTE_REQ',
      requesterId: meetingInfo.userId,
      requesterName: meetingInfo.name
    });
  };

  const handleGrantRemoteControl = (allowed) => {
    meshRef.current?.broadcast({
      type: 'REMOTE_RES',
      allowed,
      targetId: remoteControlState.requesterId
    });
    if (allowed) {
      setRemoteControlState(s => ({
        ...s,
        isBeingControlled: true,
        controllerName: s.requesterName,
        requestPending: false
      }));
    } else {
      setRemoteControlState(s => ({ ...s, requestPending: false }));
    }
  };

  const handleGrantRemoteControlToPeer = (targetPeerId, targetPeerName) => {
    meshRef.current?.broadcast({
      type: 'REMOTE_RES',
      allowed: true,
      targetId: targetPeerId
    });
    setRemoteControlState(s => ({
      ...s,
      isBeingControlled: true,
      controllerName: targetPeerName,
      requestPending: false
    }));
  };

  const handleSimulateRemoteControl = () => {
    setRemoteControlState(s => ({
      ...s,
      isBeingControlled: true,
      controllerName: 'Simulated Remote Guest',
      requestPending: false
    }));
    let count = 0;
    const interval = setInterval(() => {
      count++;
      const x = 30 + Math.sin(count * 0.45) * 25;
      const y = 35 + Math.cos(count * 0.45) * 20;
      const click = count % 5 === 0;
      setRemoteCursor({ x, y, name: 'Guest (Simulated)' });
      if (click) {
        const ripId = Date.now() + Math.random();
        setRemoteRipples(r => [...r, { id: ripId, x, y }]);
        setTimeout(() => setRemoteRipples(r => r.filter(i => i.id !== ripId)), 800);
      }
      if (count > 25) clearInterval(interval);
    }, 200);
  };

  const handleRevokeRemoteControl = () => {
    meshRef.current?.broadcast({
      type: 'REMOTE_REVOKE'
    });
    setRemoteControlState({
      isControlling: false,
      isBeingControlled: false,
      controllerName: null,
      requestPending: false,
      requesterId: null,
      requesterName: null
    });
    setRemoteCursor(null);
  };

  const handleSendRemoteMouseEvent = (eventData) => {
    meshRef.current?.broadcast({
      type: 'REMOTE_MOUSE',
      ...eventData,
      name: meetingInfo.name
    });
  };

  // Item 16: SSRF and unsafe protocol validation for co-streaming media URLs
  const isValidMediaUrl = (urlStr) => {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      const hostname = parsed.hostname.toLowerCase();
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '::1', '[::1]'];
      if (blockedHosts.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) {
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  };

  // Watch Together Co-Streaming Handlers
  const handleStartWatchTogether = (url) => {
    if (!isValidMediaUrl(url)) {
      console.warn('[Security] Blocked invalid or internal media URL for Watch Together:', url);
      return;
    }
    setWatchTogetherState({ active: true, url, isPlaying: true, currentTime: 0 });
    meshRef.current?.broadcast({
      type: 'WATCH_START',
      url
    });
  };

  const handleStopWatchTogether = () => {
    setWatchTogetherState({ active: false, url: '', isPlaying: false, currentTime: 0 });
    meshRef.current?.broadcast({
      type: 'WATCH_STOP'
    });
  };

  const handleWatchTogetherSync = (syncData) => {
    meshRef.current?.broadcast({
      type: 'WATCH_SYNC',
      sync: syncData
    });
  };

  // Authentic Zoom Feature Handlers
  const handleToggleRaiseHand = () => {
    const isUp = raisedHands.includes(meetingInfo.userId);
    const next = !isUp;
    setRaisedHands(prev => next ? [...prev, meetingInfo.userId] : prev.filter(id => id !== meetingInfo.userId));
    meshRef.current?.broadcast({
      type: 'HAND_RAISE',
      userId: meetingInfo.userId,
      raised: next
    });
  };

  const handleLowerHand = (targetId) => {
    setRaisedHands(prev => prev.filter(id => id !== targetId));
    meshRef.current?.broadcast({
      type: 'HAND_LOWER',
      userId: targetId
    });
  };

  const handleMuteAll = () => {
    meshRef.current?.broadcast({
      type: 'MUTE_ALL'
    });
  };

  const handleRenameUser = (targetId, newName) => {
    if (targetId === meetingInfo.userId) {
      setCurrentUserName(newName);
    } else {
      setPeers(prev => ({
        ...prev,
        [targetId]: { ...prev[targetId], name: newName }
      }));
    }
    meshRef.current?.broadcast({
      type: 'RENAME_USER',
      userId: targetId,
      newName
    });
  };

  const handleUpdateSecurity = (newSettings) => {
    const updated = { ...securitySettings, ...newSettings };
    setSecuritySettings(updated);
    meshRef.current?.broadcast({
      type: 'SECURITY_UPDATE',
      settings: updated
    });
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const streamToRecord = screenStream || localStream;
        if (!streamToRecord) {
          alert('No active camera or screen stream to record.');
          return;
        }
        const recorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm' });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `zoom-meeting-record-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (e) {
        console.warn('Recording error:', e);
        alert('Could not start recording: ' + e.message);
      }
    }
  };

  const handleBroadcastWhiteboardStroke = (stroke) => {
    meshRef.current?.broadcast({
      type: 'WHITEBOARD_STROKE',
      stroke
    });
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (meetingInfo.isHost) {
        meshRef.current?.broadcast({
          type: 'MEETING_ENDED'
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [meetingInfo.isHost]);

  const handleLeaveMeeting = (endForAll = false) => {
    if (meetingInfo.isHost || endForAll) {
      meshRef.current?.broadcast({
        type: 'MEETING_ENDED'
      });
    }
    try {
      sessionStorage.removeItem('p2pmeet_session');
    } catch (_) {}
    onLeave();
  };

  const handleChangeRole = (targetId, newRole) => {
    setUserRoles(prev => ({ ...prev, [targetId]: newRole }));
    meshRef.current?.broadcast({
      type: 'ROLE_UPDATE',
      targetId,
      newRole
    });
  };

  const handleRemoveUser = (targetId) => {
    meshRef.current?.broadcast({
      type: 'KICK_USER',
      targetId
    });
    setPeers(prev => {
      const copy = { ...prev };
      delete copy[targetId];
      return copy;
    });
  };

  const myRole = userRoles[meetingInfo.userId] || (meetingInfo.isHost ? 'host' : 'participant');
  const isCurrentUserHost = myRole === 'host' || myRole === 'co-host';

  const localUserObj = {
    id: meetingInfo.userId,
    name: currentUserName,
    isHost: myRole === 'host',
    role: myRole
  };

  const participantList = [
    {
      id: meetingInfo.userId,
      name: `${currentUserName} (You)`,
      isHost: myRole === 'host',
      role: myRole,
      isAudioOn: audioEnabled,
      isVideoOn: videoEnabled
    },
    ...Object.values(peers).map(p => {
      const role = userRoles[p.id] || (p.isHost ? 'host' : 'participant');
      return {
        id: p.id,
        name: p.name,
        isHost: role === 'host',
        role,
        isAudioOn: p.isAudioOn,
        isVideoOn: p.isVideoOn
      };
    })
  ];

  // Multi-Pinning up to 4 tiles
  const [pinnedIds, setPinnedIds] = useState([]);

  const handleTogglePin = (id) => {
    if (!id) return;
    setPinnedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) return [...prev.slice(0, 3), id]; // Max 4
      return [...prev, id];
    });
  };

  const handleUnpinAll = () => {
    setPinnedIds([]);
  };

  // Screen sharing / presentation / pinned info
  const activeSharer = (screenSharing && screenStream)
    ? { name: `${meetingInfo.name} (Screen)`, isLocal: true, isScreenSharing: true }
    : Object.values(peers).find(p => p.isScreenSharing);

  let presentationInfo = null;
  if (pinnedIds.length === 1) {
    const pTile = participantList.find(p => p.id === pinnedIds[0]);
    presentationInfo = {
      name: pTile?.name || 'Pinned',
      isLocal: pinnedIds[0] === meetingInfo.userId,
      isPinned: true,
      onUnpin: handleUnpinAll
    };
  } else if (pinnedIds.length === 2) {
    presentationInfo = {
      name: '2 Pinned',
      isPinned: true,
      onUnpin: handleUnpinAll
    };
  } else if (pinnedIds.length === 3) {
    presentationInfo = {
      name: '3 Pinned',
      isPinned: true,
      onUnpin: handleUnpinAll
    };
  } else if (pinnedIds.length === 4) {
    presentationInfo = {
      name: '4 Pinned',
      isPinned: true,
      onUnpin: handleUnpinAll
    };
  } else if (activeSharer) {
    const sharerTileId = activeSharer.isLocal ? `${localUserObj.id}-screen` : `${activeSharer.id}-screen`;
    const isSharerPinned = pinnedIds.includes(sharerTileId);
    presentationInfo = {
      name: activeSharer.name,
      isLocal: activeSharer.isLocal || false,
      isScreenSharing: true,
      isPinned: isSharerPinned,
      onPin: () => handleTogglePin(sharerTileId),
      onUnpin: () => handleTogglePin(sharerTileId)
    };
  } else if (watchTogetherState?.active) {
    presentationInfo = {
      name: 'Watch Party',
      isLocal: false,
      isScreenSharing: false
    };
  }

  const isPresenting = pinnedIds.length > 0 || !!activeSharer || watchTogetherState?.active;
  const peopleSidebarWidth = 0;

  return (
    <div className="relative w-screen h-[100dvh] max-h-[100dvh] bg-[#0D0B14] text-[#F8F7FC] overflow-hidden flex select-none" style={{ height: '100dvh' }}>
      {/* Ambient Liquid Glass Optical Light Spheres */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle,rgba(196,181,253,0.14)_0%,transparent_70%)] blur-[90px]" />
        <div className="absolute -bottom-[15%] -right-[10%] w-[55vw] h-[55vw] rounded-full bg-[radial-gradient(circle,rgba(255,107,53,0.12)_0%,rgba(167,139,250,0.06)_40%,transparent_70%)] blur-[100px]" />
      </div>

      {/* 1. Main Video Stage & Floating Overlay Area (resizes flexibly when drawers open) */}
      <div onClick={handleStageClick} className="flex-1 h-full w-full relative overflow-hidden flex flex-col bg-transparent z-10">
        {/* Fullscreen Video Canvas */}
        <div className="w-full h-full relative">
          <P2PGrid
            localUser={localUserObj}
            localStream={localStream}
            screenStream={screenStream}
            peers={peers}
            isAudioOn={audioEnabled}
            isVideoOn={videoEnabled}
            isScreenSharing={screenSharing}
            viewMode={viewMode}
            isMobile={isMobile}
            isMobileLandscape={isMobileLandscape}
            speakingUserId={speakingUserIds[0] || null}
            speakingUserIds={speakingUserIds}
            raisedHands={raisedHands}
            remoteControlState={remoteControlState}
            onRequestRemoteControl={handleRequestRemoteControl}
            onGrantRemoteControl={handleGrantRemoteControl}
            onGrantRemoteControlToPeer={handleGrantRemoteControlToPeer}
            onSimulateRemoteControl={handleSimulateRemoteControl}
            onRevokeRemoteControl={handleRevokeRemoteControl}
            onSendRemoteMouseEvent={handleSendRemoteMouseEvent}
            remoteCursor={remoteCursor}
            remoteRipples={remoteRipples}
            watchTogetherState={watchTogetherState}
            onWatchTogetherSync={handleWatchTogetherSync}
            onStopWatchTogether={handleStopWatchTogether}
            controlsVisible={controlsVisible || !!activePanel}
            pinnedIds={pinnedIds}
            onTogglePin={handleTogglePin}
            onUnpinAll={handleUnpinAll}
            onSetPinnedIds={setPinnedIds}
          />
        </div>

        {/* 2. Floating Top Header (stays scoped to video stage area) */}
        <P2PHeader
          title={meetingInfo.title}
          roomCode={meetingInfo.code}
          hostName={meetingInfo.name}
          isHost={isCurrentUserHost}
          onLeave={() => handleLeaveMeeting(isCurrentUserHost)}
          viewMode={viewMode}
          onToggleViewMode={(mode) => setViewMode(v => mode || (v === 'gallery' ? 'speaker' : 'gallery'))}
          isRecording={isRecording}
          onStopRecording={handleToggleRecording}
          onToggleWhiteboard={() => setWhiteboardActive(v => !v)}
          isVisible={controlsVisible || !!activePanel}
          isMobile={isMobile}
          isMobileLandscape={isMobileLandscape}
          networkStats={networkStats}
          topologyMode={topologyMode}
          isSupernode={isSupernode}
          presentationInfo={presentationInfo}
          sidebarOffset={peopleSidebarWidth}
        />

        {/* 3. Floating Bottom Controls Dock (centered within video stage area) */}
        <P2PControls
          roomCode={meetingInfo.code}
          isHost={isCurrentUserHost}
          participantCount={participantList.length}
          activePanel={activePanel}
          onTogglePanel={(panel) => setActivePanel(p => p === panel ? null : panel)}
          onSendReaction={handleSendReaction}
          onLeaveMeeting={handleLeaveMeeting}
          isHandRaised={raisedHands.includes(meetingInfo.userId)}
          onToggleRaiseHand={handleToggleRaiseHand}
          isRecording={isRecording}
          onToggleRecording={handleToggleRecording}
          onToggleWhiteboard={() => setWhiteboardActive(v => !v)}
          whiteboardActive={whiteboardActive}
          securitySettings={securitySettings}
          onUpdateSecurity={handleUpdateSecurity}
          onStartWatchTogether={handleStartWatchTogether}
          onStopWatchTogether={handleStopWatchTogether}
          watchTogetherActive={watchTogetherState.active}
          isVisible={controlsVisible || !!activePanel}
          isMobile={isMobile}
          isMobileLandscape={isMobileLandscape}
        />
      </div>

      {/* 4. Docked Side Panels (Chat & Participants) */}
      {activePanel === 'chat' && (
        <P2PChatDrawer
          messages={messages}
          currentUserId={meetingInfo.userId}
          participants={participantList}
          onSendMessage={handleSendMessage}
          activeVideoStream={screenStream || Object.values(peers)[0]?.stream || localStream}
          activeSpeakerName={screenStream ? `${meetingInfo.name}'s Screen` : (Object.values(peers)[0]?.name || `${meetingInfo.name} (You)`)}
          onSwitchPanel={(panel) => setActivePanel(panel)}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'participants' && (
        <P2PParticipantsDrawer
          participants={participantList}
          currentUserId={meetingInfo.userId}
          isHost={isCurrentUserHost}
          roomCode={meetingInfo.code}
          raisedHands={raisedHands}
          pinnedIds={pinnedIds}
          onTogglePin={handleTogglePin}
          onLowerHand={handleLowerHand}
          onMuteAll={handleMuteAll}
          onRenameUser={handleRenameUser}
          onChangeRole={handleChangeRole}
          onRemoveUser={handleRemoveUser}
          onSwitchPanel={(panel) => setActivePanel(panel)}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* 5. Interactive Excalidraw & Eraser.io Collaborative Whiteboard */}
      {whiteboardActive && (
        <P2PWhiteboard
          onClose={() => setWhiteboardActive(false)}
          onBroadcastStroke={handleBroadcastWhiteboardStroke}
          incomingStroke={incomingWhiteboardStroke}
        />
      )}

      {/* 6. Floating Reaction Animations */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 text-5xl animate-bounce"
            style={{
              left: `${r.left}%`,
              transition: 'transform 2.5s ease-out, opacity 2.5s ease-out',
              animation: 'reactionFly 2.5s forwards'
            }}
          >
            {r.emoji}
          </div>
        ))}
        {/* Remote Dual-Track Screen Audio Playback Elements (Unmixed Pure Stereo) */}
        <div className="hidden" aria-hidden="true">
          {Array.from(screenAudioStreams.entries()).map(([peerId, stream]) => (
            <RemoteScreenAudio key={peerId} stream={stream} />
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes reactionFly {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 1;
          }
          70% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(-500px) scale(1.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function RemoteScreenAudio({ stream }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(e => {
        console.warn('[Audio] Screen audio autoplay blocked:', e);
      });
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}
