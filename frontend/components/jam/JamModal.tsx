"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Copy, Check, Radio, LogOut, Users, MessageSquare, Play } from "lucide-react";
import { useJamStore } from "@/lib/stores/jamStore";
import { JamChat } from "./JamChat";

// Global Jam surface: the invite/participants modal + the "Jam ended" toast.
// Mounted once in the root layout.
export const JamModal: React.FC = () => {
  const active = useJamStore((s) => s.active);
  const isHost = useJamStore((s) => s.isHost);
  const connected = useJamStore((s) => s.connected);
  const joinCode = useJamStore((s) => s.joinCode);
  const participants = useJamStore((s) => s.participants);
  const showInvite = useJamStore((s) => s.showInvite);
  const setShowInvite = useJamStore((s) => s.setShowInvite);
  const endedNotice = useJamStore((s) => s.endedNotice);
  const dismissEnded = useJamStore((s) => s.dismissEnded);
  const endJam = useJamStore((s) => s.endJam);
  const leaveJam = useJamStore((s) => s.leaveJam);
  const inviteLink = useJamStore((s) => s.inviteLink);
  const audioUnlocked = useJamStore((s) => s.audioUnlocked);
  const currentJamTrackId = useJamStore((s) => s.currentJamTrackId);
  const guestListen = useJamStore((s) => s.guestListen);

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard needs a secure context */
    }
  };

  return (
    <>
      {/* Guest audio-unlock prompt: browsers block playback until the guest
          interacts, so the host's music can't auto-start without one tap. */}
      {active && !isHost && !audioUnlocked && currentJamTrackId && (
        <button
          onClick={() => guestListen()}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[85] bg-[#2E7DF7] hover:bg-[#1F5FD0] text-white rounded-full pl-4 pr-5 py-3 shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <Play size={16} className="fill-white" />
          <span className="text-sm font-semibold">Tap to listen along</span>
        </button>
      )}

      {/* Jam ended toast (guests) */}
      {endedNotice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-zinc-900 border border-white/15 rounded-full px-5 py-3 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <Radio size={16} className="text-red-400" />
          <span className="text-sm text-white font-medium">Jam session ended</span>
          <button onClick={dismissEnded} className="text-zinc-400 hover:text-white" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Invite / participants modal */}
      {active && showInvite && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => setShowInvite(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <h2 className="text-lg font-bold text-white">{isHost ? "You're hosting a Jam" : "Jam session"}</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              {isHost
                ? "Share this link so others can listen along in real time."
                : "You're listening along with the host."}
              {!connected && <span className="text-amber-400"> · reconnecting…</span>}
            </p>

            {isHost && (
              <>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Invite link</label>
                <div className="mt-1.5 mb-4 flex items-center gap-2">
                  <input
                    readOnly
                    value={inviteLink()}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors"
                  >
                    {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {joinCode && (
                  <p className="text-xs text-zinc-500 mb-4">
                    Join code: <span className="font-mono font-bold text-zinc-300 tracking-widest">{joinCode}</span>
                  </p>
                )}
              </>
            )}

            {/* Participants */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                <Users size={13} /> In this jam · {participants.length}
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {participants.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3">
                    {p.avatarUrl ? (
                      <Image src={p.avatarUrl} alt={p.displayName} width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-white">
                        {p.displayName?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="text-sm text-white">{p.displayName}</span>
                    {p.role === "host" && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full">Host</span>
                    )}
                  </div>
                ))}
                {participants.length === 0 && <p className="text-sm text-zinc-600">Waiting for people to join…</p>}
              </div>
            </div>

            {/* Jam chat */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                <MessageSquare size={13} /> Chat
              </div>
              <JamChat />
            </div>

            <button
              onClick={() => {
                if (isHost) endJam();
                else leaveJam();
                setShowInvite(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 border border-red-500/30 text-red-400 hover:bg-red-950/40 rounded-lg text-sm font-semibold transition-colors"
            >
              <LogOut size={16} />
              {isHost ? "End Jam for everyone" : "Leave Jam"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
