/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, Shield, UserX, MousePointer } from 'lucide-react';
import { useMeetingStore } from '../webrtc/useMeetingStore';
import { webrtcManager } from '../webrtc/WebRtcManager';

export default function ParticipantsDrawer({ onClose }) {
  const { localUser, peers, remoteControl } = useMeetingStore();

  const allParticipants = [
    {
      id: localUser.participantId,
      name: `${localUser.displayName} (You)`,
      isHost: localUser.isHost,
      isLocal: true,
      audioEnabled: localUser.audioEnabled,
      videoEnabled: localUser.videoEnabled,
    },
    ...Object.values(peers).map(p => ({
      id: p.participantId,
      name: p.displayName,
      isHost: p.role === 'HOST',
      isLocal: false,
      audioEnabled: p.audioEnabled,
      videoEnabled: p.videoEnabled,
      screenSharing: p.screenSharing
    }))
  ];

  const handleMute = (participantId) => {
    webrtcManager.muteParticipant(participantId);
  };

  const handleKick = (participantId, name) => {
    if (window.confirm(`Are you sure you want to remove ${name} from the meeting?`)) {
      webrtcManager.kickParticipant(participantId);
    }
  };

  const handleRemoteControl = (participantId) => {
    if (remoteControl.isControlling && remoteControl.targetPeerId === participantId) {
      webrtcManager.revokeRemoteControl(participantId);
    } else {
      webrtcManager.requestRemoteControl(participantId);
    }
  };

  return (
    <div className="w-80 h-full glass-panel border-l border-slate-800/80 flex flex-col z-20 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <h3 className="font-semibold text-white text-base">
          Participants ({allParticipants.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {allParticipants.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {p.name[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-200 truncate">{p.name}</span>
                  {p.isHost && (
                    <span className="flex items-center gap-0.5 text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded">
                      <Shield className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions & Status */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="p-1 text-slate-400">
                {p.audioEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
              </div>
              <div className="p-1 text-slate-400">
                {p.videoEnabled ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-slate-500" />}
              </div>

              {/* Host Controls for other peers */}
              {!p.isLocal && (
                <>
                  {/* Remote Desktop Control Button */}
                  <button
                    onClick={() => handleRemoteControl(p.id)}
                    title={
                      remoteControl.isControlling && remoteControl.targetPeerId === p.id
                        ? "Revoke Remote Desktop Control"
                        : "Request Remote Desktop Control"
                    }
                    className={`p-1.5 rounded-lg text-xs transition ${
                      remoteControl.isControlling && remoteControl.targetPeerId === p.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-blue-400 hover:bg-slate-700'
                    }`}
                  >
                    <MousePointer className="w-4 h-4" />
                  </button>

                  {/* Host-only Mute & Kick */}
                  {localUser.isHost && (
                    <>
                      {p.audioEnabled && (
                        <button
                          onClick={() => handleMute(p.id)}
                          title="Mute Participant"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition"
                        >
                          <MicOff className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleKick(p.id, p.name)}
                        title="Remove from Meeting"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
