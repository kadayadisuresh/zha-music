"use client";

import React from "react";
import Image from "next/image";
import { Radio } from "lucide-react";
import { useJamStore } from "@/lib/stores/jamStore";

// Pulsing "LIVE" pill + participant avatars. Tapping opens the Jam modal.
export const JamIndicator: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const active = useJamStore((s) => s.active);
  const participants = useJamStore((s) => s.participants);
  const setShowInvite = useJamStore((s) => s.setShowInvite);

  if (!active) return null;

  const shown = participants.slice(0, 4);
  const extra = Math.max(0, participants.length - shown.length);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setShowInvite(true);
      }}
      title="Jam session"
      className="flex items-center gap-2 rounded-full bg-red-500/15 border border-red-500/40 px-2.5 py-1 hover:bg-red-500/25 transition-colors"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      {!compact && <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Jam</span>}

      {shown.length > 0 && (
        <div className="flex -space-x-2">
          {shown.map((p) =>
            p.avatarUrl ? (
              <Image
                key={p.userId}
                src={p.avatarUrl}
                alt={p.displayName}
                width={20}
                height={20}
                title={p.displayName + (p.role === "host" ? " (host)" : "")}
                className="h-5 w-5 rounded-full ring-2 ring-black object-cover"
                unoptimized
              />
            ) : (
              <div
                key={p.userId}
                title={p.displayName}
                className="h-5 w-5 rounded-full bg-zinc-600 ring-2 ring-black flex items-center justify-center text-[9px] text-white"
              >
                {p.displayName?.[0]?.toUpperCase() || "?"}
              </div>
            )
          )}
          {extra > 0 && (
            <div className="h-5 w-5 rounded-full bg-zinc-700 ring-2 ring-black flex items-center justify-center text-[9px] text-white">
              +{extra}
            </div>
          )}
        </div>
      )}
      {compact && shown.length === 0 && <Radio size={14} className="text-red-400" />}
    </button>
  );
};
