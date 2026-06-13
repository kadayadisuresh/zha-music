"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send, MessageSquare, Users } from "lucide-react";
import { useUserStore } from "@/lib/stores/userStore";
import { usePlaylistCollab } from "./PlaylistCollabContext";

export const PlaylistChat: React.FC = () => {
  const user = useUserStore((s) => s.user);
  const collab = usePlaylistCollab();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = collab?.messages ?? [];
  const online = collab?.online ?? [];
  const connected = collab?.connected ?? false;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!collab) return;
    collab.sendChat(input);
    setInput("");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-zinc-500 p-6 text-center bg-zinc-950 border-l border-white/10">
        Sign in to chat in this playlist.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-white/10">
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-white font-semibold">
          <MessageSquare size={18} />
          <span>Chat</span>
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-zinc-600"}`} title={connected ? "Connected" : "Connecting…"} />
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <Users size={14} />
          {online.length}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 mt-8">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === user.id;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {m.avatarUrl ? (
                  <Image src={m.avatarUrl} alt="" width={28} height={28} className="rounded-full h-7 w-7 shrink-0" unoptimized />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-zinc-700 shrink-0" />
                )}
                <div className={`max-w-[75%] ${mine ? "items-end text-right" : ""}`}>
                  {!mine && <p className="text-[11px] text-zinc-400 mb-0.5">{m.displayName}</p>}
                  <div
                    className={`inline-block px-3 py-2 rounded-2xl text-sm break-words ${
                      mine ? "bg-[#2E7DF7] text-white" : "bg-zinc-800 text-zinc-100"
                    } ${m.pending ? "opacity-60" : ""}`}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-white/10 shrink-0 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message the playlist…"
          className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          aria-label="Send message"
          className="p-2 rounded-full bg-[#2E7DF7] text-white disabled:opacity-40 hover:bg-[#1F5FD0] transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
