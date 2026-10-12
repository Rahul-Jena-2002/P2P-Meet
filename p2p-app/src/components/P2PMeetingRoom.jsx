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
import { requestNativeDesktopControl, sendNativeDesktopInput } from '../lib/nativeDesktopControl';

export default function P2PMeetingRoom({ meetingInfo, onLeave }) {
  const {
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    mediaError,
    setMediaError,
    screenSharing,
    audioLevel
  } = useMedia();

  const [peers, setPeers] = useState({});
  const [messages, setMessages] = useState([]);
  const [currentUserName, setCurrentUserName] = useState(meetingInfo.name);
  const [activePanel, setActivePanel] = useState(null); // 'chat' | 'participants' | 'watch'
  const [closingPanel, setClosingPanel] = useState(null);
  const [detachedPanel, setDetachedPanel] = useState(null);
  const panelCloseTimerRef = useRef(null);
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'speaker'
  const [reactions, setReactions] = useState([]);
  const controlsVisible = true;
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [screenAudioStreams, setScreenAudioStreams] = useState(new Map());
  const [topologyMode, setTopologyMode] = useState('mesh');
  const [isSupernode, setIsSupernode] = useState(false);

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

  const spawnReaction = (emoji, senderName = currentUserName) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 80) + 10;
    setReactions(r => [...r, { id, emoji, left, senderName }]);
    setTimeout(() => {
      setReactions(r => r.filter(item => item.id !== id));
    }, 2800);
  };

  // Remote Access state
  const [remoteControlState, setRemoteControlState] = useState({
    isControlling: false,
    isBeingControlled: false,
    controllerName: null,
    requestPending: false,
    requesterId: null,
    requesterName: null,
    controllerId: null,
    nativeAvailable: false
  });
  const remoteControlStateRef = useRef(remoteControlState);
  useEffect(() => {
    remoteControlStateRef.current = remoteControlState;
  }, [remoteControlState]);
  const [remoteCursor, setRemoteCursor] = useState(null);
  const [remoteRipples, setRemoteRipples] = useState([]);
  const meshRef = useRef(null);

  useEffect(() => {
    let active = true;
    requestNativeDesktopControl('status')
      .then((status) => { if (active) setRemoteControlState(s => ({ ...s, nativeAvailable: !!status.available })); })
      .catch(() => { if (active) setRemoteControlState(s => ({ ...s, nativeAvailable: false })); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (screenSharing) return;
    const current = remoteControlStateRef.current;
    if (!current.isBeingControlled && !current.isControlling) return;
    if (current.isBeingControlled && current.controllerId) {
      meshRef.current?.sendDataToPeer(current.controllerId, { type: 'REMOTE_REVOKE' });
      requestNativeDesktopControl('revoke').catch(() => {});
    }
    setRemoteControlState(s => ({
      ...s,
      isControlling: false,
      isBeingControlled: false,
      controllerName: null,
      controllerId: null,
      requestPending: false,
      requesterId: null,
      requesterName: null
    }));
  }, [screenSharing]);

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
  const [whiteboardClosing, setWhiteboardClosing] = useState(false);
  const [whiteboardOwnerId, setWhiteboardOwnerId] = useState(null);
  const whiteboardCloseTimerRef = useRef(null);
  const [incomingWhiteboardStroke, setIncomingWhiteboardStroke] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingRequests, setRecordingRequests] = useState([]);
  const [recordingRequestPending, setRecordingRequestPending] = useState(false);
  const isRecordingRef = useRef(false);
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

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const openPanel = (panel) => {
    if (panelCloseTimerRef.current) clearTimeout(panelCloseTimerRef.current);
    setClosingPanel(null);
    setDetachedPanel(null);
    setActivePanel(panel);
  };

  const closePanel = () => {
    if (!activePanel) return;
    if (panelCloseTimerRef.current) clearTimeout(panelCloseTimerRef.current);
    setClosingPanel(activePanel);
    setActivePanel(null);
    panelCloseTimerRef.current = setTimeout(() => {
      setClosingPanel(null);
      setDetachedPanel(null);
    }, 180);
  };

  const togglePanel = (panel) => activePanel === panel ? closePanel() : openPanel(panel);

  const openWhiteboard = () => {
    if (whiteboardCloseTimerRef.current) clearTimeout(whiteboardCloseTimerRef.current);
    setWhiteboardClosing(false);
    setWhiteboardActive(true);
  };

  const closeWhiteboard = () => {
    if (whiteboardCloseTimerRef.current) clearTimeout(whiteboardCloseTimerRef.current);
    setWhiteboardClosing(true);
    whiteboardCloseTimerRef.current = setTimeout(() => {
      setWhiteboardActive(false);
      setWhiteboardClosing(false);
    }, 180);
  };

  const toggleWhiteboard = () => {
    if (!screenSharing) return;
    if (whiteboardActive) {
      meshRef.current?.broadcast({ type: 'WHITEBOARD_STATE', open: false, ownerId: meetingInfo.userId });
      setWhiteboardOwnerId(null);
      closeWhiteboard();
      return;
    }
    setWhiteboardOwnerId(meetingInfo.userId);
    openWhiteboard();
    meshRef.current?.broadcast({ type: 'WHITEBOARD_STATE', open: true, ownerId: meetingInfo.userId });
  };

  useEffect(() => {
    if (screenSharing || whiteboardOwnerId !== meetingInfo.userId) return;
    meshRef.current?.broadcast({ type: 'WHITEBOARD_STATE', open: false, ownerId: meetingInfo.userId });
    setWhiteboardOwnerId(null);
    closeWhiteboard();
  }, [screenSharing, whiteboardOwnerId, meetingInfo.userId]);

  useEffect(() => () => {
    if (panelCloseTimerRef.current) clearTimeout(panelCloseTimerRef.current);
    if (whiteboardCloseTimerRef.current) clearTimeout(whiteboardCloseTimerRef.current);
  }, []);

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

      setSpeakingUserIds(prev => (
        prev.length === activeSpeakers.length && prev.every((id, index) => id === activeSpeakers[index])
          ? prev
          : activeSpeakers
      ));
    }, 120);

    return () => {
      clearInterval(interval);
    };
  }, [audioEnabled, audioLevel, meetingInfo.userId]);

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
          isAudioOn: audioEnabled,
          isRecording: meetingInfo.isHost ? isRecordingRef.current : undefined
        });
      },
      onPeerLeave: (peerId) => {
        const isHostLeaving = peerId.startsWith('host-') || peers[peerId]?.isHost;
        setPeers(prev => {
          const updated = { ...prev };
          delete updated[peerId];
          return updated;
        });
        if (remoteControlStateRef.current.requesterId === peerId || remoteControlStateRef.current.controllerId === peerId) {
          if (remoteControlStateRef.current.isBeingControlled) requestNativeDesktopControl('revoke').catch(() => {});
          setRemoteControlState({
            isControlling: false,
            isBeingControlled: false,
            controllerName: null,
            requestPending: false,
            requesterId: null,
            requesterName: null,
            controllerId: null,
            nativeAvailable: remoteControlStateRef.current.nativeAvailable
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
      onData: (data, peerId = null) => {
        const { type } = data;

        if (type === 'chat') {
          setMessages(m => [...m, data.payload || data]);
        } else if (type === 'reaction') {
          const emoji = data.payload?.emoji || data.emoji;
          const senderId = data.payload?.senderId || data.senderId;
          const senderName = data.payload?.senderName || data.senderName || peers[senderId]?.name || 'Participant';
          spawnReaction(emoji, senderName);
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
            if (data.isHost && typeof data.isRecording === 'boolean') {
              setIsRecording(data.isRecording);
            }
          }
        } else if (type === 'REMOTE_REQ') {
          if (!peerId) return;
          setRemoteControlState(s => ({
            ...s,
            requestPending: true,
            requesterId: peerId,
            requesterName: data.requesterName || 'Participant'
          }));
        } else if (type === 'REMOTE_RES') {
          if (!peerId || data.targetId !== meetingInfo.userId) return;
          if (data.allowed) {
            setRemoteControlState(s => ({ ...s, isControlling: true, requestPending: false, controllerId: peerId }));
          } else {
            setRemoteControlState(s => ({ ...s, requestPending: false, controllerId: null }));
            alert('Remote control request was declined.');
          }
        } else if (type === 'REMOTE_REVOKE') {
          const currentControl = remoteControlStateRef.current;
          if (!peerId || (currentControl.controllerId && peerId !== currentControl.controllerId)) return;
          requestNativeDesktopControl('revoke').catch(() => {});
          setRemoteControlState({
            isControlling: false,
            isBeingControlled: false,
            controllerName: null,
            requestPending: false,
            requesterId: null,
            requesterName: null,
            controllerId: null,
            nativeAvailable: currentControl.nativeAvailable
          });
          setRemoteCursor(null);
        } else if (type === 'REMOTE_MOUSE') {
          const currentControl = remoteControlStateRef.current;
          if (!peerId || peerId !== currentControl.controllerId || !currentControl.isBeingControlled) return;
          const action = data.action || data;
          sendNativeDesktopInput(action);
          if (Number.isFinite(action.x) && Number.isFinite(action.y)) {
            setRemoteCursor({ x: action.x * 100, y: action.y * 100, name: data.name });
          }
          if (action.type === 'buttonDown') {
            const ripId = Date.now() + Math.random();
            setRemoteRipples(r => [...r, { id: ripId, x: action.x * 100, y: action.y * 100 }]);
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
        } else if (type === 'RECORD_REQUEST' && meetingInfo.isHost) {
          setRecordingRequests(prev => prev.some(request => request.requesterId === data.requesterId)
            ? prev
            : [...prev, { requesterId: data.requesterId, requesterName: data.requesterName || 'Participant' }]);
        } else if (type === 'RECORD_REQUEST_RESULT' && data.targetId === meetingInfo.userId) {
          setRecordingRequestPending(false);
          alert(data.allowed ? 'The host approved and started the recording.' : 'The host declined the recording request.');
        } else if (type === 'RECORDING_STATE') {
          if (data.isHost || peers[data.senderId]?.isHost || data.userId === meetingInfo.hostId) {
            setIsRecording(Boolean(data.isRecording));
          }
        } else if (type === 'WHITEBOARD_STATE') {
          if (data.open) {
            setWhiteboardOwnerId(data.ownerId || peerId);
            openWhiteboard();
          } else if (!data.ownerId || data.ownerId === whiteboardOwnerId || data.ownerId === peerId) {
            setWhiteboardOwnerId(null);
            closeWhiteboard();
          }
        } else if (type === 'WHITEBOARD_STROKE') {
          setWhiteboardOwnerId(data.ownerId || peerId);
          setIncomingWhiteboardStroke(data.stroke);
          openWhiteboard();
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
    const unsubscribeIncomingFiles = mesh.dataChannels.on('fileComplete', ({ peerId, fileId, name, size, blob }) => {
      const url = URL.createObjectURL(blob);
      setMessages(current => [...current, {
        type: 'file',
        fileId,
        name,
        size,
        url,
        senderId: peerId,
        senderName: mesh.participants.get(peerId)?.userName || 'Participant',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    });
    mesh.connect();

    mesh.topology?.on?.('modeChanged', ({ mode }) => {
      setTopologyMode(prev => prev === mode ? prev : mode);
    });
    const checkTopology = () => {
      if (mesh.topology) {
        const mode = mesh.topology.getMode();
        setTopologyMode(prev => prev === mode ? prev : mode);
        const relayIds = mesh.topology.getRelayIds?.(2) || [];
        const isSupernode = relayIds.includes(meetingInfo.userId);
        setIsSupernode(prev => prev === isSupernode ? prev : isSupernode);
      }
    };
    const topoTimer = setInterval(checkTopology, 2500);

    return () => {
      clearInterval(topoTimer);
      unsubscribeIncomingFiles();
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
    spawnReaction(emoji, currentUserName);
    meshRef.current?.broadcast({
      type: 'reaction',
      payload: { emoji, senderId: meetingInfo.userId, senderName: currentUserName }
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

  const handleSendFile = async (file) => {
    const mesh = meshRef.current;
    if (!mesh) throw new Error('The meeting connection is not ready yet.');
    const recipients = Array.from(mesh.dataChannels.channels.entries())
      .filter(([, channel]) => channel.readyState === 'open')
      .map(([peerId]) => peerId);
    if (recipients.length === 0) {
      throw new Error('No participant has a ready peer-to-peer connection yet. Wait for them to connect and try again.');
    }

    const results = await Promise.all(recipients.map(peerId => mesh.dataChannels.sendFile(peerId, file)));
    setMessages(current => [...current, {
      type: 'file',
      fileId: results[0]?.fileId,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      senderId: meetingInfo.userId,
      senderName: meetingInfo.name,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
  };

  const handleShareWhiteboardExport = async (file) => {
    await handleSendFile(file);
    openPanel('chat');
  };

  // Remote Control Handlers (Zoom + RemoteDesk style)
  const handleRequestRemoteControl = (targetId) => {
    const sent = meshRef.current?.sendDataToPeer(targetId, {
      type: 'REMOTE_REQ',
      requesterName: meetingInfo.name
    });
    if (!sent) {
      alert('The direct connection is not ready. Try again when the participant is connected.');
      return;
    }
    setRemoteControlState(s => ({ ...s, requestPending: true, controllerId: targetId, requesterName: 'Waiting for approval' }));
  };

  const handleGrantRemoteControl = async (allowed) => {
    const targetId = remoteControlState.requesterId;
    if (allowed) {
      try {
        const permission = await requestNativeDesktopControl('authorize');
        if (!permission.allowed) {
          if (targetId) meshRef.current?.sendDataToPeer(targetId, { type: 'REMOTE_RES', allowed: false, targetId });
          setRemoteControlState(s => ({ ...s, requestPending: false, requesterId: null, requesterName: null }));
          return;
        }
      } catch (error) {
        setMediaError(error.message);
        if (targetId) meshRef.current?.sendDataToPeer(targetId, { type: 'REMOTE_RES', allowed: false, targetId });
        setRemoteControlState(s => ({ ...s, requestPending: false, requesterId: null, requesterName: null }));
        return;
      }
    }
    const sent = targetId && meshRef.current?.sendDataToPeer(targetId, {
      type: 'REMOTE_RES', allowed, targetId
    });
    if (!sent && allowed) {
      requestNativeDesktopControl('revoke').catch(() => {});
      setMediaError('Could not reach the participant over the direct connection.');
      return;
    }
    if (allowed) {
      setRemoteControlState(s => ({
        ...s,
        isBeingControlled: true,
        controllerName: s.requesterName,
        controllerId: targetId,
        requestPending: false
      }));
    } else {
      setRemoteControlState(s => ({ ...s, requestPending: false, requesterId: null, requesterName: null }));
    }
  };

  const handleGrantRemoteControlToPeer = (targetPeerId, targetPeerName) => {
    requestNativeDesktopControl('authorize').then((permission) => {
      if (!permission.allowed) return;
      const sent = meshRef.current?.sendDataToPeer(targetPeerId, {
      type: 'REMOTE_RES',
      allowed: true,
      targetId: targetPeerId
      });
      if (!sent) {
        requestNativeDesktopControl('revoke').catch(() => {});
        setMediaError('Could not reach the participant over the direct connection.');
        return;
      }
      setRemoteControlState(s => ({
      ...s,
      isBeingControlled: true,
      controllerName: targetPeerName,
      controllerId: targetPeerId,
      requestPending: false
      }));
    }).catch(error => setMediaError(error.message));
  };

  const handleRevokeRemoteControl = () => {
    if (remoteControlState.controllerId) meshRef.current?.sendDataToPeer(remoteControlState.controllerId, {
      type: 'REMOTE_REVOKE'
    });
    requestNativeDesktopControl('revoke').catch(() => {});
    setRemoteControlState({
      isControlling: false,
      isBeingControlled: false,
      controllerName: null,
      requestPending: false,
      requesterId: null,
      requesterName: null,
      controllerId: null,
      nativeAvailable: remoteControlState.nativeAvailable
    });
    setRemoteCursor(null);
  };

  const handleSendRemoteMouseEvent = (eventData) => {
    if (!remoteControlState.controllerId) return;
    meshRef.current?.sendDataToPeer(remoteControlState.controllerId, {
      type: 'REMOTE_MOUSE',
      action: eventData,
      name: meetingInfo.name,
      x: eventData.x,
      y: eventData.y
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
    if (!meetingInfo.isHost) return false;
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      meshRef.current?.broadcast({ type: 'RECORDING_STATE', isRecording: false, userId: meetingInfo.userId, isHost: true });
      return true;
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
          setIsRecording(false);
          meshRef.current?.broadcast({ type: 'RECORDING_STATE', isRecording: false, userId: meetingInfo.userId, isHost: true });
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
        meshRef.current?.broadcast({ type: 'RECORDING_STATE', isRecording: true, userId: meetingInfo.userId, isHost: true });
        return true;
      } catch (e) {
        console.warn('Recording error:', e);
        alert('Could not start recording: ' + e.message);
        return false;
      }
    }
  };

  const handleRequestRecording = () => {
    if (meetingInfo.isHost || recordingRequestPending || isRecording) return;
    setRecordingRequestPending(true);
    meshRef.current?.broadcast({
      type: 'RECORD_REQUEST',
      requesterId: meetingInfo.userId,
      requesterName: currentUserName
    });
  };

  const handleResolveRecordingRequest = (request, approved) => {
    if (!meetingInfo.isHost) return;
    const started = approved && (isRecording || handleToggleRecording());
    meshRef.current?.broadcast({
      type: 'RECORD_REQUEST_RESULT',
      targetId: request.requesterId,
      allowed: Boolean(started)
    });
    setRecordingRequests(prev => prev.filter(item => item.requesterId !== request.requesterId));
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

  function handleLeaveMeeting(endForAll = false) {
    if (meetingInfo.isHost || endForAll) {
      meshRef.current?.broadcast({
        type: 'MEETING_ENDED'
      });
    }
    try {
      sessionStorage.removeItem('p2pmeet_session');
    } catch (_) {}
    onLeave();
  }

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

  // Screen sharing / presentation / spotlight info
  const activeSharer = (screenSharing && screenStream)
    ? { name: `${meetingInfo.name} (Screen)`, isLocal: true, isScreenSharing: true }
    : Object.values(peers).find(p => p.isScreenSharing);

  let presentationInfo = null;
  if (activeSharer) {
    presentationInfo = {
      name: activeSharer.name,
      label: activeSharer.isLocal ? 'You are presenting' : `${activeSharer.name} is presenting`,
      isLocal: activeSharer.isLocal || false,
      isScreenSharing: true,
    };
  } else if (pinnedIds.length === 1) {
    const pTile = participantList.find(p => p.id === pinnedIds[0]);
    presentationInfo = {
      name: pTile?.name || 'Participant',
      label: `Spotlight: ${pTile?.name || 'Participant'}`,
      isLocal: pinnedIds[0] === meetingInfo.userId,
    };
  } else if (pinnedIds.length === 2) {
    presentationInfo = {
      name: '2 participants',
      label: 'Spotlight view · 2 participants',
    };
  } else if (pinnedIds.length === 3) {
    presentationInfo = {
      name: '3 participants',
      label: 'Spotlight view · 3 participants',
    };
  } else if (pinnedIds.length === 4) {
    presentationInfo = {
      name: '4 participants',
      label: 'Spotlight view · 4 participants',
    };
  } else if (watchTogetherState?.active) {
    presentationInfo = {
      name: 'Watch Party',
      label: 'Watch Party',
      isLocal: false,
      isScreenSharing: false
    };
  }

  const isPresenting = pinnedIds.length > 0 || !!activeSharer || watchTogetherState?.active;
  const peopleSidebarWidth = 0;

  return (
    <div className="meeting-room relative w-screen h-[100dvh] max-h-[100dvh] bg-[#0D0B14] text-[#F8F7FC] overflow-hidden flex select-none" style={{ height: '100dvh' }}>
      {/* 1. Main Video Stage & Floating Overlay Area (resizes flexibly when drawers open) */}
      <div className="flex-1 h-full w-full min-w-0 relative overflow-hidden flex flex-col bg-transparent z-10">
        {/* Fullscreen Video Canvas */}
        <div className="w-full h-full relative">
        {mediaError && (
          <div role="status" className="absolute left-1/2 top-12 z-[60] flex max-w-[min(92vw,32rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#161324]/90 px-3.5 py-2 text-xs text-[#F8F7FC] shadow-lg backdrop-blur-xl">
            <span>{mediaError}</span>
            <button type="button" onClick={() => setMediaError(null)} className="shrink-0 rounded-md px-2 py-1 text-[#C4B5FD] hover:bg-white/10" aria-label="Dismiss message">Dismiss</button>
          </div>
        )}
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
            onSetPinnedIds={setPinnedIds}
            isSidePanelOpen={Boolean(activePanel)}
            stageOverlay={whiteboardActive ? (
              <P2PWhiteboard
                onClose={whiteboardOwnerId === meetingInfo.userId ? toggleWhiteboard : closeWhiteboard}
                onBroadcastStroke={handleBroadcastWhiteboardStroke}
                onShareExport={handleShareWhiteboardExport}
                incomingStroke={incomingWhiteboardStroke}
                isEmbedded
                isClosing={whiteboardClosing}
                canEdit={screenSharing && whiteboardOwnerId === meetingInfo.userId}
              />
            ) : null}
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
          onToggleRecording={handleToggleRecording}
          onRequestRecording={meetingInfo.isHost ? undefined : handleRequestRecording}
          recordingRequestPending={recordingRequestPending}
          recordingRequests={recordingRequests}
          onResolveRecordingRequest={handleResolveRecordingRequest}
          onToggleWhiteboard={screenSharing ? toggleWhiteboard : undefined}
          isVisible
          isMobile={isMobile}
          isMobileLandscape={isMobileLandscape}
          presentationInfo={presentationInfo}
          sidebarOffset={peopleSidebarWidth}
          securitySettings={securitySettings}
          onUpdateSecurity={handleUpdateSecurity}
        />

        {/* 3. Floating Bottom Controls Dock (centered within video stage area) */}
        <P2PControls
          roomCode={meetingInfo.code}
          isHost={isCurrentUserHost}
          participantCount={participantList.length}
          activePanel={activePanel}
          onTogglePanel={togglePanel}
          onSendReaction={handleSendReaction}
          onLeaveMeeting={handleLeaveMeeting}
          isHandRaised={raisedHands.includes(meetingInfo.userId)}
          onToggleRaiseHand={handleToggleRaiseHand}
          onToggleWhiteboard={screenSharing ? toggleWhiteboard : undefined}
          canUseWhiteboard={screenSharing}
          whiteboardActive={whiteboardActive}
          onStartWatchTogether={handleStartWatchTogether}
          onStopWatchTogether={handleStopWatchTogether}
          watchTogetherActive={watchTogetherState.active}
          isVisible
          isMobile={isMobile}
          isMobileLandscape={isMobileLandscape}
        />
      </div>

      {/* 4. Docked Side Panels (Chat & Participants) */}
      {(activePanel === 'chat' || closingPanel === 'chat') && (
        <P2PChatDrawer
          messages={messages}
          currentUserId={meetingInfo.userId}
          participants={participantList}
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          activeVideoStream={screenStream || Object.values(peers)[0]?.stream || localStream}
          activeSpeakerName={screenStream ? `${meetingInfo.name}'s Screen` : (Object.values(peers)[0]?.name || `${meetingInfo.name} (You)`)}
          onSwitchPanel={openPanel}
          isDetached={detachedPanel === 'chat'}
          onToggleDetach={() => setDetachedPanel(value => value === 'chat' ? null : 'chat')}
          isClosing={activePanel !== 'chat'}
          onClose={closePanel}
        />
      )}

      {(activePanel === 'participants' || closingPanel === 'participants') && (
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
          onSwitchPanel={openPanel}
          isDetached={detachedPanel === 'participants'}
          onToggleDetach={() => setDetachedPanel(value => value === 'participants' ? null : 'participants')}
          isClosing={activePanel !== 'participants'}
          onClose={closePanel}
        />
      )}

      {/* 6. Floating Reaction Animations */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 text-5xl"
            style={{
              left: `${r.left}%`,
              animation: 'reactionFly 1.8s cubic-bezier(0.2, 0.65, 0.3, 1) forwards',
              willChange: 'transform, opacity'
            }}
          >
            {r.emoji}
            <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
              {r.senderName}
            </span>
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
            transform: translate3d(0, 0, 0) scale(0.82);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            transform: translate3d(0, -34vh, 0) scale(1.06);
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
