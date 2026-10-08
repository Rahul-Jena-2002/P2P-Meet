'use client';
/*
 * p2pmeet - Decentralized Privacy-First Video Meetings & File Sharing
 * Copyright (C) 2026 p2pmeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React from 'react';

export default function P2PLogo({ size = 32, showText = false, textClassName = "text-lg", className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Privacy-First P2P Vector Emblem */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform hover:scale-105 duration-200"
      >
        {/* Soft Obsidian Base Shield Container */}
        <rect width="48" height="48" rx="14" fill="#161324" stroke="rgba(196, 181, 253, 0.20)" strokeWidth="1.5" />

        {/* Interconnected P2P Infinity / Shield Paths */}
        {/* Left Peer Loop (Electric Orange #FF6B35) */}
        <path
          d="M17 17C14.7909 17 13 18.7909 13 21C13 23.2091 14.7909 25 17 25C19.5 25 21.5 23 24 24"
          stroke="#FF6B35"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Right Peer Loop (Frosted Lavender #C4B5FD) */}
        <path
          d="M31 31C33.2091 31 35 29.2091 35 27C35 24.7909 33.2091 23 31 23C28.5 23 26.5 25 24 24"
          stroke="#C4B5FD"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Central Privacy Shield & Keyhole */}
        <path
          d="M24 13L30 16V22C30 26.5 27.5 30.5 24 32C20.5 30.5 18 26.5 18 22V16L24 13Z"
          fill="#0D0B14"
          stroke="#F8F7FC"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Central Lock Core */}
        <circle cx="24" cy="21" r="2.2" fill="#FF6B35" />
        <path
          d="M24 23.2V26.5"
          stroke="#FF6B35"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Node Accents */}
        <circle cx="15.5" cy="21" r="2" fill="#FF6B35" />
        <circle cx="32.5" cy="27" r="2" fill="#C4B5FD" />
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-bold tracking-tight text-[#F8F7FC] ${textClassName}`}>
            p2p<span className="text-[#FF6B35]">meet</span>
          </span>
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-[#C4B5FD]">
            E2EE Direct
          </span>
        </div>
      )}
    </div>
  );
}
