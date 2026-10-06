/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
package com.openmeet.modules.signaling.model;

public enum SignalType {
    JOIN_ROOM,
    ROOM_JOINED,
    PEER_JOINED,
    PEER_LEFT,
    OFFER,
    ANSWER,
    ICE_CANDIDATE,
    CHAT_MESSAGE,
    CHAT_HISTORY,
    MEDIA_STATE,
    MUTE_PARTICIPANT,
    KICK_PARTICIPANT,
    END_MEETING,
    CONTROL_REQUEST,
    CONTROL_APPROVED,
    CONTROL_DENIED,
    CONTROL_REVOKED,
    CONTROL_EVENT,
    ERROR
}
