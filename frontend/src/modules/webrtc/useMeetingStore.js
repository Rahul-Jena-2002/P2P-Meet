/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { create } from 'zustand';

export const useMeetingStore = create((set, get) => ({
  meeting: null,
  token: null,
  localUser: {
    participantId: null,
    displayName: 'You',
    isHost: false,
    audioEnabled: true,
    videoEnabled: true,
    screenSharing: false,
  },
  localStream: null,
  screenStream: null,
  peers: {}, // { [participantId]: { participantId, displayName, role, stream, audioEnabled, videoEnabled, screenSharing } }
  chatMessages: [],
  activeTab: null, // 'chat' | 'participants' | null
  pinnedPeerId: null,
  activeSpeakerId: null,
  
  // Remote desktop control state
  remoteControl: {
    status: 'idle', // 'idle' | 'pending_approval' | 'granted' | 'active'
    targetPeerId: null,
    isControlling: false,
    isBeingControlled: false,
  },

  notifications: [],

  setMeetingData: (meeting, token, localUser) => set({ meeting, token, localUser }),
  
  setLocalStream: (stream) => set({ localStream: stream }),
  setScreenStream: (stream) => set({ screenStream: stream }),

  toggleAudio: () => {
    const { localUser, localStream } = get();
    const newAudio = !localUser.audioEnabled;
    if (localStream) {
      localStream.getAudioTracks().forEach(track => { track.enabled = newAudio; });
    }
    set({ localUser: { ...localUser, audioEnabled: newAudio } });
    return newAudio;
  },

  toggleVideo: () => {
    const { localUser, localStream } = get();
    const newVideo = !localUser.videoEnabled;
    if (localStream) {
      localStream.getVideoTracks().forEach(track => { track.enabled = newVideo; });
    }
    set({ localUser: { ...localUser, videoEnabled: newVideo } });
    return newVideo;
  },

  setScreenSharing: (isSharing) => {
    const { localUser } = get();
    set({ localUser: { ...localUser, screenSharing: isSharing } });
  },

  addOrUpdatePeer: (peer) => set((state) => ({
    peers: {
      ...state.peers,
      [peer.participantId]: {
        ...(state.peers[peer.participantId] || {}),
        ...peer
      }
    }
  })),

  updatePeerStream: (participantId, stream) => set((state) => {
    if (!state.peers[participantId]) return state;
    return {
      peers: {
        ...state.peers,
        [participantId]: {
          ...state.peers[participantId],
          stream
        }
      }
    };
  }),

  removePeer: (participantId) => set((state) => {
    const updated = { ...state.peers };
    delete updated[participantId];
    return {
      peers: updated,
      pinnedPeerId: state.pinnedPeerId === participantId ? null : state.pinnedPeerId
    };
  }),

  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages, msg]
  })),

  setChatMessages: (messages) => set({ chatMessages: messages }),

  setActiveTab: (tab) => set((state) => ({
    activeTab: state.activeTab === tab ? null : tab
  })),

  setPinnedPeerId: (id) => set((state) => ({
    pinnedPeerId: state.pinnedPeerId === id ? null : id
  })),

  setActiveSpeakerId: (id) => set({ activeSpeakerId: id }),

  setRemoteControlState: (rcState) => set((state) => ({
    remoteControl: { ...state.remoteControl, ...rcState }
  })),

  addNotification: (text, type = 'info') => {
    const id = Date.now() + Math.random();
    set((state) => ({
      notifications: [...state.notifications, { id, text, type }]
    }));
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, 4000);
  },

  resetMeeting: () => {
    const { localStream, screenStream } = get();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    set({
      meeting: null,
      token: null,
      localStream: null,
      screenStream: null,
      peers: {},
      chatMessages: [],
      activeTab: null,
      pinnedPeerId: null,
      activeSpeakerId: null,
      remoteControl: {
        status: 'idle',
        targetPeerId: null,
        isControlling: false,
        isBeingControlled: false,
      }
    });
  }
}));
