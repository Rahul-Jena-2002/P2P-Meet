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

  const [peers, setPeers] = useState({}); // { [peerId]: { id, name, stream, isHost, isAudioOn, isVideoOn } }
  const [messages, setMessages] = useState([]);
  const [activePanel, setActivePanel] = useState(null); // 'chat' | 'participants' | null
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'speaker'
  const [reactions, setReactions] = useState([]); // [{ id, emoji, left }]

  const meshRef = useRef(null);

  // Initialize P2P Mesh
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
            isVideoOn: true
          }
        }));
      },
      onPeerLeave: (peerId) => {
        setPeers(prev => {
          const updated = { ...prev };
          delete updated[peerId];
          return updated;
        });
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
        if (data.type === 'CHAT') {
          setMessages(m => [...m, data.payload]);
        } else if (data.type === 'REACTION') {
          spawnReaction(data.payload.emoji);
        } else if (data.type === 'MUTE_ALL') {
          // If remote host muted all
        }
      }
    });

    meshRef.current = mesh;
    mesh.connect();

    return () => {
      mesh.destroy();
    };
  }, [meetingInfo.code, meetingInfo.userId]);

  // Update stream when screen share or camera changes
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.replaceStream(screenStream || localStream);
    }
  }, [localStream, screenStream]);

  const spawnReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 80) + 10; // random 10% - 90%
    setReactions(r => [...r, { id, emoji, left }]);
    setTimeout(() => {
      setReactions(r => r.filter(item => item.id !== id));
    }, 2800);
  };

  const handleSendReaction = (emoji) => {
    spawnReaction(emoji);
    meshRef.current?.broadcast({
      type: 'REACTION',
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
      type: 'CHAT',
      payload: msg
    });
  };

  const handleMuteAll = () => {
    meshRef.current?.broadcast({
      type: 'MUTE_ALL'
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
      {/* 1. TOP-MOST LAYER: Fullscreen Edge-to-Edge Video Grid */}
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
          onMuteAll={handleMuteAll}
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
