/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { useMeetingStore } from '../webrtc/useMeetingStore';
import { webrtcManager } from '../webrtc/WebRtcManager';

export default function ChatDrawer({ onClose }) {
  const { chatMessages, localUser } = useMeetingStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    webrtcManager.sendChatMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="w-80 h-full glass-panel border-l border-slate-800/80 flex flex-col z-20 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <h3 className="font-semibold text-white text-base">In-Meeting Chat</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm text-center">
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Send a message to start the conversation.</p>
          </div>
        ) : (
          chatMessages.map((msg, idx) => {
            const isMe = msg.senderId === localUser.participantId;
            const timeStr = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-xs font-medium text-slate-400">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span className="text-[10px] text-slate-600">{timeStr}</span>
                </div>
                <div
                  className={`px-3.5 py-2 rounded-2xl max-w-[85%] text-sm break-words ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800/80 bg-dark-900/60">
        <div className="flex items-center gap-2 bg-slate-800/90 rounded-xl px-3 py-1.5 border border-slate-700/80 focus-within:border-blue-500 transition">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-1.5 text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
