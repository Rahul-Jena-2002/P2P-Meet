'use client';
/*
 * p2pmeet - Decentralized Privacy-First Video Meetings & File Sharing
 * Copyright (C) 2026 p2pmeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Users, Paperclip, Download, FileText, ArrowDownToLine, ShieldCheck, FileQuestion, MessageSquare, PictureInPicture2 } from 'lucide-react';

export default function P2PChatDrawer({
  messages,
  currentUserId,
  onSendMessage,
  onSendFile,
  onRequestFile,
  participants = [],
  activeVideoStream,
  activeSpeakerName,
  onSwitchPanel,
  isDetached = false,
  onToggleDetach,
  isClosing = false,
  onClose
}) {
  const [text, setText] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTarget, setRequestTarget] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const pipVideoRef = useRef(null);

  useEffect(() => {
    if (pipVideoRef.current && activeVideoStream) {
      pipVideoRef.current.srcObject = activeVideoStream;
      pipVideoRef.current.play().catch(() => {});
    }
  }, [activeVideoStream]);

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
    if (file.size > 500 * 1024 * 1024) {
      window.alert('Files must be 500 MB or smaller.');
      e.target.value = '';
      return;
    }
    Promise.resolve(onSendFile?.(file)).catch((error) => {
      window.alert(error?.message || 'Could not send this file directly to the participants.');
    });
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

  const [drawerWidth, setDrawerWidth] = useState(384);
  const [detachedFrame, setDetachedFrame] = useState(null);
  const isResizingRef = useRef(false);

  const handleStartDrag = (e) => {
    if (!isDetached || e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    const onMove = (event) => {
      const left = Math.max(8, Math.min(window.innerWidth - start.width - 8, start.left + event.clientX - start.x));
      const top = Math.max(56, Math.min(window.innerHeight - start.height - 72, start.top + event.clientY - start.y));
      setDetachedFrame({ left, top, width: start.width, height: start.height });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleStartResize = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = drawerWidth;

    const onMouseMove = (moveEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = startX - moveEvent.clientX;
      const newW = Math.max(280, Math.min(680, startW + deltaX));
      setDrawerWidth(newW);
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const otherParticipants = participants.filter(p => p.id !== currentUserId);

  return (
    <aside
      style={isDetached
        ? detachedFrame ? { left: detachedFrame.left, top: detachedFrame.top, right: 'auto', bottom: 'auto', width: detachedFrame.width, height: detachedFrame.height } : undefined
        : { width: `${drawerWidth}px` }}
      className={`meeting-drawer ${isDetached ? 'meeting-drawer-detached' : 'fixed inset-y-0 right-0 md:relative md:inset-auto'} ${isClosing ? 'is-closing' : ''} max-w-[90vw] h-full border-l border-white/15 flex flex-col z-30 select-text liquid-glass-panel text-[#F8F7FC] shadow-2xl shrink-0`}
    >
      {/* Draggable resize handle on left border */}
      <div
        onMouseDown={handleStartResize}
        className="absolute top-0 bottom-0 -left-1 w-2 cursor-col-resize hover:bg-[#FF6B35]/50 active:bg-[#FF6B35] transition z-40 flex items-center justify-center select-none group"
        title="Drag to resize sidebar"
      >
        <div className="w-0.5 h-10 rounded-full bg-white/20 group-hover:bg-[#FF6B35] transition" />
      </div>
      {/* Header with Clean Separated Context Tabs */}
      <div onPointerDown={handleStartDrag} className={`h-12 px-3 border-b border-[rgba(196,181,253,0.14)] flex items-center justify-between bg-transparent shrink-0 ${isDetached ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}>
        <div className="flex items-center gap-1.5">
          {onSwitchPanel && (
            <button
              onClick={() => onSwitchPanel('participants')}
              className="text-xs px-2.5 py-1 text-white/55 hover:text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>People ({participants.length})</span>
            </button>
          )}
          <span className="text-xs px-2.5 py-1 text-white font-semibold flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onToggleDetach} className="p-1.5 rounded-lg text-white/65 hover:text-white hover:bg-white/10 transition" title={isDetached ? 'Dock chat' : 'Float chat'} aria-label={isDetached ? 'Dock chat' : 'Float chat'}>
            <PictureInPicture2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/65 hover:text-white hover:bg-white/10 transition cursor-pointer" title="Close Chat" aria-label="Close chat">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recipient & Action Bar */}
      <div className="px-4 py-2 border-b border-white/10 bg-white/[0.025] flex items-center justify-between text-xs text-white/60">
        <div className="flex items-center gap-1.5">
          <span>To:</span>
          <span className="flex items-center gap-1.5 font-semibold text-white/85 bg-white/[0.08] border border-white/15 px-2 py-0.5 rounded-lg text-[11px]">
            <Users className="w-3 h-3 text-[#FF6B35]" /> Everyone
          </span>
        </div>

        {otherParticipants.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRequestModal(!showRequestModal)}
            className="flex items-center gap-1 text-[11px] text-[#FF6B35] hover:text-[#FFA14A] font-semibold transition"
          >
            <FileQuestion className="w-3.5 h-3.5" />
            <span>Request File</span>
          </button>
        )}
      </div>

      {/* File Request Dialog */}
      {showRequestModal && (
        <div className="p-3 bg-[#221C35] border-b border-[rgba(196,181,253,0.14)] text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between font-semibold text-[#C4B5FD]">
            <span>Request File from Participant</span>
            <button onClick={() => setShowRequestModal(false)} className="text-[#C4B5FD]/50 hover:text-[#F8F7FC]">✕</button>
          </div>
          <form onSubmit={handleSendFileRequest} className="space-y-2">
            <select
              value={requestTarget}
              onChange={(e) => setRequestTarget(e.target.value)}
              className="w-full bg-[#0D0B14] px-2.5 py-1.5 rounded-xl border border-[rgba(196,181,253,0.18)] text-xs text-[#F8F7FC] focus:outline-none focus:border-[#FF6B35]"
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
              className="w-full bg-[#0D0B14] px-2.5 py-1.5 rounded-xl border border-[rgba(196,181,253,0.18)] text-xs text-[#F8F7FC] placeholder-[#C4B5FD]/35 focus:outline-none focus:border-[#FF6B35]"
            />
            <button
              type="submit"
              disabled={!requestTarget}
              className="w-full py-2 rounded-xl bg-[#FF6B35] hover:brightness-110 disabled:opacity-40 text-[#0D0B14] font-bold transition shadow-md shadow-[#FF6B35]/20"
            >
              Send Request
            </button>
          </form>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#C4B5FD]/40 text-xs text-center">
            <FileText className="w-8 h-8 opacity-40 mb-2" />
            <p className="text-[#F8F7FC]/70">No messages or files shared yet.</p>
            <p className="mt-1 text-[11px] text-[#C4B5FD]/40">
              Send a message or share a file with everyone in the meeting.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.senderId === currentUserId;
            return (
              <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-[#C4B5FD]">
                    {isMe ? 'You' : m.senderName}
                  </span>
                  <span className="text-[10px] text-[#C4B5FD]/45">{m.time}</span>
                </div>

                {/* 1. File Card Message */}
                {m.type === 'file' ? (
                  <div className={`p-3 rounded-2xl max-w-[85%] border transition ${
                    isMe
                      ? 'bg-[#221C35] border-[#FF6B35]/40 rounded-tr-none'
                      : 'bg-[#221C35] border-[rgba(196,181,253,0.18)] rounded-tl-none'
                  }`}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-[#0D0B14] flex items-center justify-center text-[#C4B5FD] shrink-0 border border-[rgba(196,181,253,0.15)]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#F8F7FC] truncate">{m.name}</p>
                        <p className="text-[10px] text-[#C4B5FD]/60">{formatFileSize(m.size)}</p>
                      </div>
                    </div>

                    <a
                      href={m.url || undefined}
                      aria-disabled={!m.url}
                      onClick={(event) => { if (!m.url) event.preventDefault(); }}
                      download={m.name}
                      className="w-full py-1.5 px-3 rounded-xl bg-[#FF6B35] hover:brightness-110 text-[#0D0B14] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#FF6B35]/20 transition"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </a>
                  </div>
                ) : m.type === 'request' ? (
                  /* 2. File Request Message */
                  <div className="p-3 rounded-2xl max-w-[85%] bg-[rgba(196,181,253,0.12)] border border-[rgba(196,181,253,0.25)] text-xs space-y-2">
                    <p className="font-semibold text-[#FFA14A] flex items-center gap-1.5">
                      <FileQuestion className="w-4 h-4" /> File Request
                    </p>
                    <p className="text-[#F8F7FC]">
                      Request for <strong>{m.targetName}</strong>: {m.note || 'Requested a file transfer'}
                    </p>
                    {m.targetId === currentUserId && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-1.5 rounded-xl bg-[#FF6B35] hover:brightness-110 text-[#0D0B14] font-bold text-xs flex items-center justify-center gap-1.5 transition shadow"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Send Requested File</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* 3. Regular Text Message */
                  <div className={`chat-message-bubble px-4 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed shadow-sm ${
                    isMe
                      ? 'chat-message-bubble-sent font-semibold rounded-tr-none'
                      : 'chat-message-bubble-received rounded-tl-none'
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
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 bg-white/[0.035]">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-2 bg-white/[0.07] rounded-2xl px-3 py-2 border border-white/15 focus-within:border-white/35 transition shadow-inner backdrop-blur-xl">
          {/* File Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-xl text-[#C4B5FD]/70 hover:text-[#FFA14A] hover:bg-[rgba(196,181,253,0.08)] transition"
            title="Attach and send a file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message or attach file..."
            className="flex-1 bg-transparent text-xs text-[#F8F7FC] placeholder-[#C4B5FD]/35 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!text.trim()}
            className="p-1.5 rounded-xl text-[#FF6B35] hover:text-[#FFA14A] disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
