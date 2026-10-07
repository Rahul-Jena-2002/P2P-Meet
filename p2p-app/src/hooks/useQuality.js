/*
 * OpenMeet - React Hook: useQuality
 * Clean React adapter projecting runtime WebRTC network and telemetry state.
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useState, useEffect } from 'react';

export function useQuality(meetingController) {
  const [stats, setStats] = useState({
    rtt: 0,
    lossRate: 0,
    quality: 'excellent',
    scaleFactor: 1.0,
    activePeers: 0
  });

  useEffect(() => {
    if (!meetingController?.quality) return;

    const unsub = meetingController.quality.on('stats', (data) => {
      setStats(data);
    });

    return () => unsub();
  }, [meetingController]);

  return stats;
}
