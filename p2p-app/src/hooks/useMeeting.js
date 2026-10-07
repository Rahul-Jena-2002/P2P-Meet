/*
 * OpenMeet - React Hook: useMeeting
 * Clean React adapter projecting MeetingController state without exposing WebRTC internals.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MeetingController } from '../core/meeting/MeetingController.js';

export function useMeeting({ roomId, userId, userName, stream = null }) {
  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [networkStats, setNetworkStats] = useState(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!roomId || !userId) return;

    const controller = new MeetingController({
      roomId,
      userId,
      userName,
      onNetworkStats: setNetworkStats,
    });

    controllerRef.current = controller;

    controller.on('connected', () => setIsConnected(true));
    controller.on('disconnected', () => setIsConnected(false));
    controller.on('participantsChanged', (list) => setParticipants([...list]));

    controller.join();

    return () => {
      controller.leave();
      controllerRef.current = null;
    };
  }, [roomId, userId, userName]);

  useEffect(() => {
    if (controllerRef.current && stream) {
      controllerRef.current.replaceStream(stream);
    }
  }, [stream]);

  const broadcast = useCallback((data) => {
    controllerRef.current?.broadcast(data);
  }, []);

  const sendChatMessage = useCallback((text) => {
    controllerRef.current?.sendChatMessage(text);
  }, []);

  const sendFile = useCallback(async (peerId, fileData) => {
    return controllerRef.current?.dataChannels.sendFile(peerId, fileData);
  }, []);

  return {
    controller: controllerRef.current,
    participants,
    isConnected,
    networkStats,
    broadcast,
    sendChatMessage,
    sendFile
  };
}
