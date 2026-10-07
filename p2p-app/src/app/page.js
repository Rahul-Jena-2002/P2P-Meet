'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect } from 'react';
import { MediaProvider } from '@/components/MediaProvider';
import GreenRoom from '@/components/GreenRoom';
import P2PMeetingRoom from '@/components/P2PMeetingRoom';

const SESSION_KEY = 'p2pmeet_session';

export default function Home() {
  const [meetingState, setMeetingState] = useState(null); // { code, title, name, isHost, userId }

  // Restore after reload (client only, avoids hydration mismatch)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (saved?.code && saved?.userId) setMeetingState(saved);
    } catch {}
  }, []);

  const handleJoinMeeting = ({ code, title, name, isHost }) => {
    const userId = `${isHost ? 'host' : 'peer'}-${Math.random().toString(36).substring(2, 7)}`;
    const state = { code, title, name, isHost, userId };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    setMeetingState(state);
  };

  const handleLeaveMeeting = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setMeetingState(null);
  };

  return (
    <MediaProvider>
      <main className="w-screen h-screen overflow-hidden bg-[#1C1C1C] text-[#F5E8D8]">
        {meetingState ? (
          <P2PMeetingRoom
            meetingInfo={meetingState}
            onLeave={handleLeaveMeeting}
          />
        ) : (
          <GreenRoom onJoinMeeting={handleJoinMeeting} />
        )}
      </main>
    </MediaProvider>
  );
}
