'use client';
/*
 * p2pmeet - Decentralized Privacy-First Video Meetings & File Sharing
 * Copyright (C) 2026 p2pmeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileText, Send, ShieldCheck, Check, ArrowDownToLine, Clock, FileQuestion, Users } from 'lucide-react';

export default function P2PFilesDrawer({
  participants,
  currentUserId,
  onSendFile,
  onRequestFile,
  transfers = [],
  receivedFiles = [],
  fileRequests = [],
  onClose
}) {
  const [selectedPeerId, setSelectedPeerId] = useState('all');
  const [requestTargetId, setRequestTargetId] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB max per browser memory transfer
  const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.scr', '.msi', '.ps1', '.jar', '.com', '.pif'];

  const sanitizeFilename = (name) => {
    if (!name) return 'download_file';
    // Remove directory traversal, control chars, and null bytes
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file';
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    setFileError(null);

    const validFiles = [];
    for (const file of Array.from(files)) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        setFileError(`Transfer blocked: Executable file types (${ext}) are prohibited for security.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File "${file.name}" exceeds the 500 MB peer transfer limit.`);
        return;
      }
      validFiles.push(file);
    }

    validFiles.forEach((file) => {
      onSendFile?.(file, selectedPeerId);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleSendRequest = (e) => {
    e.preventDefault();
    if (!requestTargetId) return;
    const target = participants.find(p => p.id === requestTargetId);
    onRequestFile?.(requestTargetId, target?.name || 'Participant', requestNote.trim());
    setRequestTargetId('');
    setRequestNote('');
  };

  const otherParticipants = participants.filter(p => p.id !== currentUserId);

  return (
    <aside className="w-80 sm:w-96 h-full p2p-panel border-l border-[rgba(196,181,253,0.14)] flex flex-col z-30 animate-in slide-in-from-right duration-200 select-none bg-[#161324] text-[#F8F7FC]">
      {/* Header */}
      <div className="p-4 border-b border-[rgba(196,181,253,0.14)] flex items-center justify-between bg-[#161324]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#F8F7FC] tracking-tight">Direct P2P Files</h3>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[rgba(196,181,253,0.14)] text-[#C4B5FD] border border-[rgba(196,181,253,0.25)] font-bold">
            Zero Cloud
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#C4B5FD]/50 hover:text-[#F8F7FC] hover:bg-[rgba(196,181,253,0.10)] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recipient Picker */}
      <div className="px-4 py-2 border-b border-[rgba(196,181,253,0.14)] bg-[#0D0B14]/40 flex items-center justify-between text-xs text-[#C4B5FD]/70">
        <span>Send to:</span>
        <select
          value={selectedPeerId}
          onChange={(e) => setSelectedPeerId(e.target.value)}
          className="bg-[#0D0B14] px-2.5 py-1 rounded-xl border border-[rgba(196,181,253,0.18)] text-xs text-[#F8F7FC] focus:outline-none focus:border-[#FF6B35]"
        >
          <option value="all">Everyone in Call</option>
          {otherParticipants.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Security Warning Alert for Blocked Files */}
        {fileError && (
          <div className="p-3 rounded-2xl bg-[#FF6B35]/15 border border-[#FF6B35]/40 text-[#FFA14A] text-xs flex items-start justify-between gap-2 animate-in fade-in">
            <span>⚠️ {fileError}</span>
            <button
              onClick={() => setFileError(null)}
              className="text-[#FFA14A] hover:text-white font-bold text-sm leading-none shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Drag & Drop Upload Box */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center transition ${
            isDragging
              ? 'border-[#FF6B35] bg-[rgba(255,107,53,0.10)]'
              : 'border-[rgba(196,181,253,0.20)] hover:border-[#FF6B35] bg-[#221C35]/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="w-10 h-10 rounded-full bg-[#0D0B14] flex items-center justify-center text-[#FF6B35] mb-2 border border-[rgba(196,181,253,0.18)] shadow-sm">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-[#F8F7FC]">Click or Drag files to transfer</p>
          <p className="text-[10px] text-[#C4B5FD]/60 mt-0.5">Direct encrypted browser-to-browser pipe</p>
        </div>

        {/* Request File from Peer Section */}
        {otherParticipants.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#221C35] border border-[rgba(196,181,253,0.15)] space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C4B5FD]">
              <FileQuestion className="w-3.5 h-3.5 text-[#FFA14A]" />
              <span>Request File from Participant</span>
            </div>
            <form onSubmit={handleSendRequest} className="space-y-2">
              <select
                value={requestTargetId}
                onChange={(e) => setRequestTargetId(e.target.value)}
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
                placeholder="Note (e.g. Please share presentation PDF)"
                className="w-full bg-[#0D0B14] px-2.5 py-1.5 rounded-xl border border-[rgba(196,181,253,0.18)] text-xs text-[#F8F7FC] placeholder-[#C4B5FD]/35 focus:outline-none focus:border-[#FF6B35]"
              />
              <button
                type="submit"
                disabled={!requestTargetId}
                className="w-full py-1.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] hover:brightness-110 disabled:opacity-40 text-[#0D0B14] font-bold text-xs transition shadow-md shadow-[#FF6B35]/20"
              >
                Send Request Prompt
              </button>
            </form>
          </div>
        )}

        {/* Incoming File Requests Banner */}
        {fileRequests.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-[#FFA14A] tracking-wider block">
              Incoming File Requests
            </span>
            {fileRequests.map((req, i) => (
              <div key={i} className="p-3 rounded-2xl bg-[rgba(196,181,253,0.12)] border border-[rgba(196,181,253,0.25)] text-xs space-y-1.5">
                <p className="font-medium text-[#F8F7FC]">
                  <strong className="text-[#FFA14A]">{req.requesterName}</strong> requested a file
                </p>
                {req.note && <p className="text-[11px] text-[#C4B5FD]/80 italic">"{req.note}"</p>}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-1.5 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] hover:brightness-110 text-[#0D0B14] font-bold text-[11px] flex items-center justify-center gap-1.5 shadow"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose File to Send</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Active Outgoing / Incoming Transfers */}
        {transfers.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-[#C4B5FD]/50 tracking-wider block">
              Active Transfers
            </span>
            {transfers.map((t, i) => (
              <div key={i} className="p-3 rounded-2xl bg-[#221C35] border border-[rgba(196,181,253,0.15)] text-xs space-y-1.5">
                <div className="flex items-center justify-between font-medium">
                  <span className="truncate max-w-[180px]">{t.name}</span>
                  <span className="text-[#FFA14A] font-mono text-[10px] font-bold">{t.progress || 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#0D0B14] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] transition-all duration-150"
                    style={{ width: `${t.progress || 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#C4B5FD]/60">
                  <span>{formatFileSize(t.size)}</span>
                  <span>{t.status || 'Transferring...'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Received Files Download List */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#C4B5FD]/50 tracking-wider block">
            Received Files ({receivedFiles.length})
          </span>
          {receivedFiles.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#221C35]/30 border border-[rgba(196,181,253,0.10)] text-center text-[#C4B5FD]/40 text-xs">
              <FileText className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p>No files received yet</p>
              <p className="text-[10px] text-[#C4B5FD]/30 mt-0.5">Files sent by peers will appear here</p>
            </div>
          ) : (
            receivedFiles.map((file, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl bg-[#221C35] border border-[rgba(196,181,253,0.15)] flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#0D0B14] flex items-center justify-center text-[#C4B5FD] shrink-0 border border-[rgba(196,181,253,0.15)]">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F8F7FC] truncate">{file.name}</p>
                    <p className="text-[10px] text-[#C4B5FD]/60">
                      {formatFileSize(file.size)} • from {file.senderName || 'Peer'}
                    </p>
                  </div>
                </div>

                <a
                  href={file.url}
                  download={sanitizeFilename(file.name)}
                  className="p-2 rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#FFA14A] hover:brightness-110 text-[#0D0B14] font-bold transition shrink-0 shadow-md shadow-[#FF6B35]/20"
                  title="Download File"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[rgba(196,181,253,0.14)] bg-[#161324] flex items-center justify-center gap-1.5 text-[11px] text-[#C4B5FD]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B35]" />
        <span>End-to-End Encrypted Wire (DTLS/SRTP)</span>
      </div>
    </aside>
  );
}
