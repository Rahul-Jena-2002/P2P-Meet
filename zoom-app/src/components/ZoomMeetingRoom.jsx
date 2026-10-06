'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import { useMedia } from './MediaProvider';
import { P2PMesh } from '../lib/p2pMesh';
import ZoomHeader from './ZoomHeader';
import ZoomGrid from './ZoomGrid';
import ZoomControls from './ZoomControls';
import ZoomChatDrawer from './ZoomChatDrawer';
import ZoomParticipantsDrawer from './ZoomParticipantsDrawer';

export default function ZoomMeetingRoom({ meetingInfo, onLeave }) {
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
  const [activePanel, setActivePanel] = useState(null); // 'chat' | 'participants' | 'watch'
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'speaker'
  const [reactions, setReactions] = useState([]);

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

  const meshRef = useRef(null);

  useEffect(() => {
    const mesh = new P2PMesh({
      roomId: meetingInfo.code,
      userId: meetingInfo.userId,
      userName: meetingInfo.name,
      stream: localStream,
      onPeerJoin: (peerId, name) => {
        setPeers(prev => ({
          ...prev,
          [peerId]: {
            id: peerId,
            name: name || 'Participant',
            stream: null,
            isHost: false,
            isAudioOn: true,
            isVideoOn: true,
            isScreenSharing: false
          }
        }));
        // Notify new joiner of current state
        meshRef.current?.broadcast({
          type: 'PEER_MEDIA_STATE',
          userId: meetingInfo.userId,
          userName: meetingInfo.name,
          isScreenSharing: screenSharing,
          isVideoOn: videoEnabled,
          isAudioOn: audioEnabled
        });
      },
      onPeerLeave: (peerId) => {
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
      onData: (data) => {
        const { type } = data;

        if (type === 'chat') {
          setMessages(m => [...m, data]);
        } else if (type === 'reaction') {
          spawnReaction(data.emoji);
        } else if (type === 'PEER_MEDIA_STATE') {
          setPeers(prev => ({
            ...prev,
            [data.userId]: {
              ...(prev[data.userId] || {}),
              id: data.userId,
              name: data.userName || prev[data.userId]?.name,
              isScreenSharing: !!data.isScreenSharing,
              isVideoOn: data.isVideoOn !== false,
              isAudioOn: data.isAudioOn !== false
            }
          }));
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
        }
      }
    });

    meshRef.current = mesh;
    mesh.connect();

    return () => {
      mesh.destroy();
    };
  }, [meetingInfo.code, meetingInfo.userId]);

  // Update stream and broadcast state when screen share or camera changes
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.replaceStream(screenStream || localStream);
      meshRef.current.broadcast({
        type: 'PEER_MEDIA_STATE',
        userId: meetingInfo.userId,
        userName: meetingInfo.name,
        isScreenSharing: screenSharing,
        isVideoOn: videoEnabled,
        isAudioOn: audioEnabled
      });
    }
  }, [localStream, screenStream, screenSharing, videoEnabled, audioEnabled]);

  const spawnReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 80) + 10;
    setReactions(r => [...r, { id, emoji, left }]);
    setTimeout(() => {
      setReactions(r => r.filter(item => item.id !== id));
    }, 2800);
  };

  const handleSendReaction = (emoji) => {
    spawnReaction(emoji);
    meshRef.current?.broadcast({
      type: 'reaction',
      payload: { emoji, senderId: meetingInfo.userId }
    });
  };

  const handleSendMessage = (text) => {
    const msg = {
      senderId: meetingInfo.userId,
      senderName: meetingInfo.name,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  // Watch Together Co-Streaming Handlers
  const handleStartWatchTogether = (url) => {
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

  const localUserObj = {
    id: meetingInfo.userId,
    name: meetingInfo.name,
    isHost: meetingInfo.isHost
  };

  const participantList = [
    {
      id: meetingInfo.userId,
      name: `${meetingInfo.name} (You)`,
      isHost: meetingInfo.isHost,
      isAudioOn: audioEnabled,
      isVideoOn: videoEnabled
    },
    ...Object.values(peers).map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isAudioOn: p.isAudioOn,
      isVideoOn: p.isVideoOn
    }))
  ];

  return (
    <div className="relative w-screen h-screen bg-[#090b10] overflow-hidden flex select-none">
      {/* 1. TOP-MOST LAYER: Fullscreen Edge-to-Edge Video Canvas */}
      <div className="flex-1 h-full w-full relative">
        <ZoomGrid
          localUser={localUserObj}
          localStream={localStream}
          screenStream={screenStream}
          peers={peers}
          isAudioOn={audioEnabled}
          isVideoOn={videoEnabled}
          isScreenSharing={screenSharing}
          viewMode={viewMode}
          speakingUserId={audioLevel > 20 ? meetingInfo.userId : null}
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
        />
      </div>

      {/* 2. Floating Top Header */}
      <ZoomHeader
        title={meetingInfo.title}
        roomCode={meetingInfo.code}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(v => v === 'gallery' ? 'speaker' : 'gallery')}
      />

      {/* 3. Floating Bottom Controls Dock */}
      <ZoomControls
        roomCode={meetingInfo.code}
        isHost={meetingInfo.isHost}
        participantCount={participantList.length}
        activePanel={activePanel}
        onTogglePanel={(panel) => setActivePanel(p => p === panel ? null : panel)}
        onSendReaction={handleSendReaction}
        onLeaveMeeting={onLeave}
        onStartWatchTogether={handleStartWatchTogether}
        onStopWatchTogether={handleStopWatchTogether}
        watchTogetherActive={watchTogetherState.active}
      />

      {/* 4. Side Drawers (Chat & Participants) */}
      {activePanel === 'chat' && (
        <ZoomChatDrawer
          messages={messages}
          currentUserId={meetingInfo.userId}
          onSendMessage={handleSendMessage}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === 'participants' && (
        <ZoomParticipantsDrawer
          participants={participantList}
          isHost={meetingInfo.isHost}
          roomCode={meetingInfo.code}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* 5. Floating Reaction Animations */}
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
