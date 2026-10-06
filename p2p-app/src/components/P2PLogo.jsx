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
        {/* Soft Black Base Shield Container */}
        <rect width="48" height="48" rx="14" fill="#242424" stroke="rgba(245, 232, 216, 0.12)" strokeWidth="1.5" />

        {/* Interconnected P2P Infinity / Shield Paths */}
        {/* Left Peer Loop (Coral #FF6F61) */}
        <path
          d="M17 17C14.7909 17 13 18.7909 13 21C13 23.2091 14.7909 25 17 25C19.5 25 21.5 23 24 24"
          stroke="#FF6F61"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Right Peer Loop (Golden Yellow #DAA520) */}
        <path
          d="M31 31C33.2091 31 35 29.2091 35 27C35 24.7909 33.2091 23 31 23C28.5 23 26.5 25 24 24"
          stroke="#DAA520"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Central Privacy Shield & Keyhole */}
        <path
          d="M24 13L30 16V22C30 26.5 27.5 30.5 24 32C20.5 30.5 18 26.5 18 22V16L24 13Z"
          fill="#1C1C1C"
          stroke="#F5E8D8"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Central Lock Core */}
        <circle cx="24" cy="21" r="2.2" fill="#DAA520" />
        <path
          d="M24 23.2V26.5"
          stroke="#DAA520"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Node Accents */}
        <circle cx="15.5" cy="21" r="2" fill="#FF6F61" />
        <circle cx="32.5" cy="27" r="2" fill="#DAA520" />
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-bold tracking-tight text-[#F5E8D8] ${textClassName}`}>
            p2p<span className="text-[#FF6F61]">meet</span>
          </span>
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-[#DAA520]">
            E2EE Direct
          </span>
        </div>
      )}
    </div>
  );
}
