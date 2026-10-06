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
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
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
    <aside className="w-80 sm:w-96 h-full p2p-panel border-l border-[#F5E8D8]/10 flex flex-col z-30 animate-in slide-in-from-right duration-200 select-none bg-[#1C1C1C]/95 text-[#F5E8D8]">
      {/* Header */}
      <div className="p-4 border-b border-[#F5E8D8]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#F5E8D8] tracking-tight">Direct P2P Files</h3>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#DAA520]/15 text-[#DAA520] border border-[#DAA520]/25 font-bold">
            Zero Cloud
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#F5E8D8]/50 hover:text-[#F5E8D8] hover:bg-white/[0.06] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recipient Picker */}
      <div className="px-4 py-2 border-b border-[#F5E8D8]/10 bg-[#1C1C1C]/40 flex items-center justify-between text-xs text-[#F5E8D8]/70">
        <span>Send to:</span>
        <select
          value={selectedPeerId}
          onChange={(e) => setSelectedPeerId(e.target.value)}
          className="bg-[#242424] px-2.5 py-1 rounded-lg border border-[#F5E8D8]/15 text-xs text-[#F5E8D8] focus:outline-none focus:border-[#FF6F61]"
        >
          <option value="all">Everyone in Call</option>
          {otherParticipants.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Drag & Drop Upload Box */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center transition ${
            isDragging
              ? 'border-[#FF6F61] bg-[#FF6F61]/10'
              : 'border-[#F5E8D8]/15 hover:border-[#FF6F61]/40 bg-[#242424]/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="w-10 h-10 rounded-full bg-[#1C1C1C] flex items-center justify-center text-[#FF6F61] mb-2 border border-[#F5E8D8]/10">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-[#F5E8D8]">Click or Drag files to transfer</p>
          <p className="text-[10px] text-[#F5E8D8]/50 mt-0.5">Direct encrypted browser-to-browser pipe</p>
        </div>

        {/* Request File from Peer Section */}
        {otherParticipants.length > 0 && (
          <div className="p-3 rounded-2xl bg-[#242424]/80 border border-[#F5E8D8]/10 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#DAA520]">
              <FileQuestion className="w-3.5 h-3.5" />
              <span>Request File from Participant</span>
            </div>
            <form onSubmit={handleSendRequest} className="space-y-2">
              <select
                value={requestTargetId}
                onChange={(e) => setRequestTargetId(e.target.value)}
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
                placeholder="Note (e.g. Please share the presentation PDF)"
                className="w-full bg-[#1C1C1C] px-2.5 py-1.5 rounded-lg border border-[#F5E8D8]/15 text-xs text-[#F5E8D8] placeholder-[#F5E8D8]/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!requestTargetId}
                className="w-full py-1.5 rounded-lg bg-[#DAA520] hover:bg-[#DAA520]/90 disabled:opacity-40 text-[#1C1C1C] font-semibold text-xs transition"
              >
                Send Request Prompt
              </button>
            </form>
          </div>
        )}

        {/* Incoming File Requests Banner */}
        {fileRequests.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-[#DAA520] tracking-wider block">
              Incoming File Requests
            </span>
            {fileRequests.map((req, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-[#DAA520]/10 border border-[#DAA520]/30 text-xs space-y-1.5">
                <p className="font-medium text-[#F5E8D8]">
                  <strong className="text-[#DAA520]">{req.requesterName}</strong> requested a file
                </p>
                {req.note && <p className="text-[11px] text-[#F5E8D8]/70 italic">"{req.note}"</p>}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-1 rounded-lg bg-[#DAA520] text-[#1C1C1C] font-bold text-[11px] flex items-center justify-center gap-1.5"
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
            <span className="text-[10px] uppercase font-bold text-[#F5E8D8]/50 tracking-wider block">
              Active Transfers
            </span>
            {transfers.map((t, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-[#242424] border border-[#F5E8D8]/10 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-medium">
                  <span className="truncate max-w-[180px]">{t.name}</span>
                  <span className="text-[#DAA520] font-mono text-[10px]">{t.progress || 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF6F61] transition-all duration-150"
                    style={{ width: `${t.progress || 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#F5E8D8]/50">
                  <span>{formatFileSize(t.size)}</span>
                  <span>{t.status || 'Transferring...'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Received Files Download List */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#F5E8D8]/50 tracking-wider block">
            Received Files ({receivedFiles.length})
          </span>
          {receivedFiles.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#242424]/40 border border-[#F5E8D8]/5 text-center text-[#F5E8D8]/40 text-xs">
              <FileText className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p>No files received yet</p>
              <p className="text-[10px] text-[#F5E8D8]/30 mt-0.5">Files sent by peers will appear here</p>
            </div>
          ) : (
            receivedFiles.map((file, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-[#242424] border border-[#F5E8D8]/10 flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#1C1C1C] flex items-center justify-center text-[#DAA520] shrink-0 border border-[#F5E8D8]/10">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#F5E8D8] truncate">{file.name}</p>
                    <p className="text-[10px] text-[#F5E8D8]/50">
                      {formatFileSize(file.size)} • from {file.senderName || 'Peer'}
                    </p>
                  </div>
                </div>

                <a
                  href={file.url}
                  download={file.name}
                  className="p-2 rounded-lg bg-[#FF6F61] hover:bg-[#FF4500] text-[#1C1C1C] hover:text-white transition shrink-0"
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
      <div className="p-3 border-t border-[#F5E8D8]/10 bg-[#1C1C1C]/80 flex items-center justify-center gap-1.5 text-[11px] text-[#DAA520]">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>End-to-End Encrypted Wire (DTLS/SRTP)</span>
      </div>
    </aside>
  );
}
