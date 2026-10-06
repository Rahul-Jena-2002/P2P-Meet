'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Users } from 'lucide-react';

export default function ZoomChatDrawer({ messages, currentUserId, onSendMessage, onClose }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  return (
    <aside className="w-80 sm:w-96 h-full zoom-panel border-l border-white/10 flex flex-col z-30 animate-in slide-in-from-right duration-200 select-text">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wide">Meeting Chat</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Recipient Selector (Zoom Style) */}
      <div className="px-4 py-2 border-b border-white/5 bg-black/20 flex items-center gap-2 text-xs text-slate-400">
        <span>To:</span>
        <span className="flex items-center gap-1 font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
          <Users className="w-3 h-3" /> Everyone
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs text-center">
            <p>No messages yet.</p>
            <p className="mt-1">Messages sent here are visible to everyone.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderId === currentUserId;
            return (
              <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {isMe ? 'You' : m.senderName}
                  </span>
                  <span className="text-[10px] text-slate-500">{m.time}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                  isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'
                }`}>
                  {m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 bg-black/30">
        <div className="flex items-center gap-2 bg-[#1b1f2a] rounded-xl px-3 py-2 border border-white/10 focus-within:border-blue-500 transition">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message here..."
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="p-1 text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
