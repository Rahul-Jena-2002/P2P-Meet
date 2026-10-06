'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState } from 'react';
import { MediaProvider } from '@/components/MediaProvider';
import GreenRoom from '@/components/GreenRoom';
import ZoomMeetingRoom from '@/components/ZoomMeetingRoom';

export default function Home() {
  const [meetingState, setMeetingState] = useState(null); // { code, title, name, isHost, userId }

  const handleJoinMeeting = ({ code, title, name, isHost }) => {
    const userId = `${isHost ? 'host' : 'peer'}-${Math.random().toString(36).substring(2, 7)}`;
    setMeetingState({
      code,
      title,
      name,
      isHost,
      userId
    });
  };

  const handleLeaveMeeting = () => {
    setMeetingState(null);
  };

  return (
    <MediaProvider>
      <main className="w-screen h-screen overflow-hidden bg-[#090b10]">
        {meetingState ? (
          <ZoomMeetingRoom
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
