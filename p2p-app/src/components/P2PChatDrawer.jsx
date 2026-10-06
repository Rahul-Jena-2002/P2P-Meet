'use client';
/*
 * p2pmeet - Decentralized Privacy-First Video Meetings & File Sharing
 * Copyright (C) 2026 p2pmeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Users, Paperclip, Download, FileText, ArrowDownToLine, ShieldCheck, FileQuestion } from 'lucide-react';

export default function P2PChatDrawer({
  messages,
  currentUserId,
  onSendMessage,
  onSendFile,
  onRequestFile,
  participants = [],
  onClose
}) {
  const [text, setText] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTarget, setRequestTarget] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage({ type: 'text', text: text.trim() });
    setText('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onSendMessage({
        type: 'file',
        name: file.name,
        size: file.size,
        data: reader.result
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendFileRequest = (e) => {
    e.preventDefault();
    if (!requestTarget) return;
    const targetPeer = participants.find(p => p.id === requestTarget);
    onSendMessage({
      type: 'request',
      targetId: requestTarget,
      targetName: targetPeer?.name || 'Participant',
      note: requestNote.trim()
    });
    setShowRequestModal(false);
    setRequestTarget('');
    setRequestNote('');
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const otherParticipants = participants.filter(p => p.id !== currentUserId);

  return (
    <aside className="w-80 sm:w-96 h-full p2p-panel border-l border-[#F5E8D8]/10 flex flex-col z-40 relative animate-in slide-in-from-right duration-200 select-text bg-[#1C1C1C] text-[#F5E8D8] shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-[#F5E8D8]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#F5E8D8] tracking-wide">Meeting Chat & Files</h3>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#DAA520]/15 text-[#DAA520] border border-[#DAA520]/25 font-bold">
            P2P
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-[#F5E8D8]/60 hover:text-[#F5E8D8] hover:bg-white/[0.08] transition"
          title="Close Chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recipient & Action Bar */}
      <div className="px-4 py-2 border-b border-[#F5E8D8]/10 bg-[#1C1C1C]/40 flex items-center justify-between text-xs text-[#F5E8D8]/60">
        <div className="flex items-center gap-1.5">
          <span>To:</span>
          <span className="flex items-center gap-1 font-semibold text-[#DAA520] bg-[#DAA520]/10 border border-[#DAA520]/20 px-2 py-0.5 rounded-md text-[11px]">
            <Users className="w-3 h-3" /> Everyone
          </span>
        </div>

        {otherParticipants.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRequestModal(!showRequestModal)}
            className="flex items-center gap-1 text-[11px] text-[#FF6F61] hover:text-[#FF4500] font-semibold transition"
          >
            <FileQuestion className="w-3.5 h-3.5" />
            <span>Request File</span>
          </button>
        )}
      </div>

      {/* File Request Dialog */}
      {showRequestModal && (
        <div className="p-3 bg-[#242424] border-b border-[#F5E8D8]/10 text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between font-semibold text-[#DAA520]">
            <span>Request File from Participant</span>
            <button onClick={() => setShowRequestModal(false)} className="text-[#F5E8D8]/50 hover:text-[#F5E8D8]">✕</button>
          </div>
          <form onSubmit={handleSendFileRequest} className="space-y-2">
            <select
              value={requestTarget}
              onChange={(e) => setRequestTarget(e.target.value)}
              className="w-full bg-[#1C1C1C] px-2.5 py-1.5 rounded-lg border border-[#F5E8D8]/15 text-xs text-[#F5E8D8] focus:outline-none"
            >
              <option value="">Select participant...</option>
              {otherParticipants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="What file do you need? (e.g. Project PDF)"
              className="w-full bg-[#1C1C1C] px-2.5 py-1.5 rounded-lg border border-[#F5E8D8]/15 text-xs text-[#F5E8D8] placeholder-[#F5E8D8]/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!requestTarget}
              className="w-full py-1.5 rounded-lg bg-[#FF6F61] hover:bg-[#FF4500] disabled:opacity-40 text-[#1C1C1C] font-semibold transition"
            >
              Send Request
            </button>
          </form>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#F5E8D8]/40 text-xs text-center">
            <FileText className="w-8 h-8 opacity-40 mb-2" />
            <p>No messages or files shared yet.</p>
            <p className="mt-1 text-[11px] text-[#F5E8D8]/30">
              Send messages or attach any file to share directly via P2P.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderId === currentUserId;
            return (
              <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-[#F5E8D8]/80">
                    {isMe ? 'You' : m.senderName}
                  </span>
                  <span className="text-[10px] text-[#F5E8D8]/40">{m.time}</span>
                </div>

                {/* 1. File Card Message */}
                {m.type === 'file' ? (
                  <div className={`p-3 rounded-2xl max-w-[85%] border transition ${
                    isMe
                      ? 'bg-[#282828] border-[#FF6F61]/40 rounded-tr-none'
                      : 'bg-[#242424] border-[#F5E8D8]/10 rounded-tl-none'
                  }`}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#1C1C1C] flex items-center justify-center text-[#DAA520] shrink-0 border border-[#F5E8D8]/10">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#F5E8D8] truncate">{m.name}</p>
                        <p className="text-[10px] text-[#F5E8D8]/50">{formatFileSize(m.size)} • Direct P2P</p>
                      </div>
                    </div>

                    <a
                      href={m.data}
                      download={m.name}
                      className="w-full py-1.5 px-3 rounded-xl bg-[#FF6F61] hover:bg-[#FF4500] text-[#1C1C1C] hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </a>
                  </div>
                ) : m.type === 'request' ? (
                  /* 2. File Request Message */
                  <div className="p-3 rounded-2xl max-w-[85%] bg-[#DAA520]/10 border border-[#DAA520]/30 text-xs space-y-2">
                    <p className="font-semibold text-[#DAA520] flex items-center gap-1.5">
                      <FileQuestion className="w-4 h-4" /> File Request
                    </p>
                    <p className="text-[#F5E8D8]">
                      Request for <strong>{m.targetName}</strong>: {m.note || 'Requested a file transfer'}
                    </p>
                    {m.targetId === currentUserId && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-1.5 rounded-lg bg-[#DAA520] hover:bg-[#DAA520]/90 text-[#1C1C1C] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Send Requested File</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* 3. Regular Text Message */
                  <div className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                    isMe
                      ? 'bg-[#FF6F61] text-[#1C1C1C] font-semibold rounded-tr-none'
                      : 'bg-[#242424] text-[#F5E8D8] rounded-tl-none border border-[#F5E8D8]/10'
                  }`}>
                    {m.text}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Message & Attachment Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#F5E8D8]/10 bg-[#1C1C1C]/60">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-2 bg-[#242424] rounded-xl px-2.5 py-1.5 border border-[#F5E8D8]/15 focus-within:border-[#FF6F61] transition">
          {/* File Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-[#F5E8D8]/60 hover:text-[#DAA520] hover:bg-white/[0.06] transition"
            title="Attach & Send Any File (Encrypted Direct P2P)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message or attach file..."
            className="flex-1 bg-transparent text-xs text-[#F5E8D8] placeholder-[#F5E8D8]/30 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!text.trim()}
            className="p-1.5 rounded-lg text-[#FF6F61] hover:text-[#FF4500] disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
