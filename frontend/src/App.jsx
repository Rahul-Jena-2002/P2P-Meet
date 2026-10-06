/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React from 'react';
import { useMeetingStore } from './modules/webrtc/useMeetingStore';
import LandingPage from './modules/landing/LandingPage';
import MeetingRoom from './modules/meeting/MeetingRoom';

export default function App() {
  const { meeting } = useMeetingStore();

  return (
    <div className="w-full h-full min-h-screen bg-dark-900 text-slate-100 flex flex-col">
      {meeting ? <MeetingRoom /> : <LandingPage />}
    </div>
  );
}
