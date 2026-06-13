"use client";

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api/client";
import { useUserStore } from "@/lib/stores/userStore";
import { PlaylistSocket, ChatMessage, PresenceUser } from "@/lib/services/playlistSocket";

interface LastChange {
  actor: string;
  kind: string; // track_added | track_removed | track_reordered
  at: number;
}

interface CollabValue {
  enabled: boolean;
  connected: boolean;
  online: PresenceUser[];
  messages: ChatMessage[];
  lastChange: LastChange | null;
  revision: number; // bumps on any remote track change
  sendChat: (text: string) => void;
  addTrack: (songId: string) => void;
  removeTrack: (songId: string) => void;
  reorderTrack: (songId: string, newPosition: number) => void;
}

const Ctx = createContext<CollabValue | null>(null);
export const usePlaylistCollab = () => useContext(Ctx);

const uid = () => Math.random().toString(36).slice(2);

export function PlaylistCollabProvider({
  playlistId,
  enabled,
  children,
}: {
  playlistId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const user = useUserStore((s) => s.user);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastChange, setLastChange] = useState<LastChange | null>(null);
  const [revision, setRevision] = useState(0);
  const socketRef = useRef<PlaylistSocket | null>(null);

  const upsertMessage = useCallback((msg: ChatMessage, clientMsgId?: string) => {
    setMessages((prev) => {
      if (clientMsgId) {
        const i = prev.findIndex((m) => m.clientMsgId === clientMsgId || m.id === clientMsgId);
        if (i !== -1) {
          const copy = [...prev];
          copy[i] = { ...msg, pending: false };
          return copy;
        }
      }
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  useEffect(() => {
    if (!enabled || !user) {
      setConnected(false);
      setOnline([]);
      return;
    }
    let cancelled = false;

    fetch(`${API_BASE_URL}/playlist/${playlistId}/messages`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => !cancelled && Array.isArray(rows) && setMessages(rows))
      .catch(() => {});

    const socket = new PlaylistSocket(playlistId, {
      onChat: upsertMessage,
      onSyncState: (users) => setOnline(users),
      onPresence: (p) => {
        setOnline((prev) => {
          if (p.state === "leave") return prev.filter((u) => u.userId !== p.userId);
          if (prev.some((u) => u.userId === p.userId)) return prev;
          return [...prev, { userId: p.userId, displayName: p.displayName, avatarUrl: p.avatarUrl }];
        });
      },
      onTrackChange: (kind, payload) => {
        setLastChange({ actor: payload?.actor?.displayName || "Someone", kind, at: Date.now() });
        setRevision((r) => r + 1);
      },
      onStatus: setConnected,
    });
    socket.connect();
    socketRef.current = socket;

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [playlistId, enabled, user, upsertMessage]);

  const sendChat = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || !socketRef.current || !user) return;
      const clientMsgId = uid();
      setMessages((prev) => [
        ...prev,
        {
          id: clientMsgId,
          clientMsgId,
          userId: user.id,
          displayName: user.display_name || "You",
          avatarUrl: user.avatar_url,
          text: t,
          createdAt: new Date().toISOString(),
          pending: true,
        },
      ]);
      socketRef.current.sendChat(t, clientMsgId);
    },
    [user]
  );

  const addTrack = useCallback((songId: string) => socketRef.current?.addTrack(songId), []);
  const removeTrack = useCallback((songId: string) => socketRef.current?.removeTrack(songId), []);
  const reorderTrack = useCallback(
    (songId: string, newPosition: number) => socketRef.current?.reorderTrack(songId, newPosition),
    []
  );

  const value: CollabValue = {
    enabled,
    connected,
    online,
    messages,
    lastChange,
    revision,
    sendChat,
    addTrack,
    removeTrack,
    reorderTrack,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
