"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send } from "lucide-react";
import { useUserStore } from "@/lib/stores/userStore";
import { useJamStore } from "@/lib/stores/jamStore";

/** Real-time chat for the live Jam, rendered inside the Jam modal. Messages are
 *  relayed over the same jam WebSocket — everyone in the session sees them. */
export const JamChat: React.FC = () => {
  const user = useUserStore((s) => s.user);
  const messages = useJamStore((s) => s.messages);
  const sendChat = useJamStore((s) => s.sendChat);
  const connected = useJamStore((s) => s.connected);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendChat(text);
    setInput("");
  };

  return (
    <div className="flex flex-col h-56 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-zinc-500 mt-6">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === user?.id;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {m.avatarUrl ? (
                  <Image src={m.avatarUrl} alt="" width={24} height={24} className="rounded-full h-6 w-6 shrink-0" unoptimized />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-zinc-700 shrink-0 flex items-center justify-center text-[10px] text-white">
                    {m.displayName?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                  {!mine && <p className="text-[10px] text-zinc-400 mb-0.5">{m.displayName}</p>}
                  <div
                    className={`inline-block px-3 py-1.5 rounded-2xl text-sm break-words ${
                      mine ? "bg-[#2E7DF7] text-white" : "bg-zinc-800 text-zinc-100"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 border-t border-white/10 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={connected ? "Message the jam…" : "Connecting…"}
          disabled={!connected}
          className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-60"
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
