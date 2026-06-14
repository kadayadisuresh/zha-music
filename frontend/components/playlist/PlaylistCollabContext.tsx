"use client";

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import * as sb from "@/lib/supabase/data";
import { useUserStore } from "@/lib/stores/userStore";

// Phase 17 · Slice 3 — collaborative playlist realtime on Supabase Realtime
// (Broadcast for chat + track-change events, Presence for who's online).
// DB writes (songs, chat history) go through supabase-js under RLS.

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  text: string;
  createdAt: string | null;
  pending?: boolean;
}

export interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

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
  revision: number;
  sendChat: (text: string) => void;
  addTrack: (songId: string) => void;
  removeTrack: (songId: string) => void;
  reorderTrack: (songId: string, newPosition: number) => void;
}

const Ctx = createContext<CollabValue | null>(null);
export const usePlaylistCollab = () => useContext(Ctx);

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

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
  const channelRef = useRef<RealtimeChannel | null>(null);

  const upsertMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  useEffect(() => {
    if (!enabled || !user) {
      setConnected(false);
      setOnline([]);
      return;
    }
    const numericId = Number(playlistId);
    if (!Number.isFinite(numericId)) return;

    let cancelled = false;
    const supabase = getSupabase();

    // Initial chat history (RLS: owner or collaborator)
    sb.getPlaylistMessages(numericId)
      .then((rows) => { if (!cancelled) setMessages(rows); })
      .catch(() => {});

    const channel = supabase.channel(`playlist:${playlistId}`, {
      config: { presence: { key: user.id }, broadcast: { self: true } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const seen = new Map<string, PresenceUser>();
        Object.values(state).forEach((metas) =>
          (metas as Array<Record<string, unknown>>).forEach((m) =>
            seen.set(m.userId as string, {
              userId: m.userId as string,
              displayName: m.displayName as string,
              avatarUrl: (m.avatarUrl as string | null) ?? null,
            })
          )
        );
        setOnline([...seen.values()]);
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => upsertMessage(payload as ChatMessage))
      .on("broadcast", { event: "track_change" }, ({ payload }) => {
        const p = payload as { kind: string; actor?: { displayName?: string } };
        setLastChange({ actor: p.actor?.displayName || "Someone", kind: p.kind, at: Date.now() });
        setRevision((r) => r + 1);
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          channel.track({
            userId: user.id,
            displayName: user.display_name || "Anonymous",
            avatarUrl: user.avatar_url ?? null,
          });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [playlistId, enabled, user, upsertMessage]);

  const sendChat = useCallback(
    (text: string) => {
      const t = text.trim();
      const channel = channelRef.current;
      if (!t || !channel || !user) return;
      const msg: ChatMessage = {
        id: newId(),
        userId: user.id,
        displayName: user.display_name || "You",
        avatarUrl: user.avatar_url ?? null,
        text: t,
        createdAt: new Date().toISOString(),
      };
      upsertMessage(msg); // optimistic; the self-echoed broadcast dedupes by id
      channel.send({ type: "broadcast", event: "chat", payload: msg });
      sb.insertPlaylistMessage({
        id: msg.id,
        playlistId: Number(playlistId),
        userId: user.id,
        displayName: msg.displayName,
        avatarUrl: msg.avatarUrl ?? null,
        text: t,
      }).catch(() => {});
    },
    [user, playlistId, upsertMessage]
  );

  const broadcastTrackChange = useCallback(
    (kind: string) => {
      // self:true → the sender also receives this, bumping its own revision so
      // its track list refetches (banner is suppressed for one's own change).
      channelRef.current?.send({
        type: "broadcast",
        event: "track_change",
        payload: { kind, actor: { displayName: user?.display_name || "Someone" } },
      });
    },
    [user]
  );

  const addTrack = useCallback(
    async (songId: string) => {
      try {
        await sb.addSongToPlaylist(Number(playlistId), songId);
        broadcastTrackChange("track_added");
      } catch (e) { console.error("collab addTrack failed", e); }
    },
    [playlistId, broadcastTrackChange]
  );

  const removeTrack = useCallback(
    async (songId: string) => {
      try {
        await sb.removeSongFromPlaylist(Number(playlistId), songId);
        broadcastTrackChange("track_removed");
      } catch (e) { console.error("collab removeTrack failed", e); }
    },
    [playlistId, broadcastTrackChange]
  );

  const reorderTrack = useCallback(
    (_songId: string, _newPosition: number) => {
      // Reorder persistence isn't in the supabase data layer yet; broadcasting
      // keeps collaborators in sync once a reorder write is added.
      broadcastTrackChange("track_reordered");
    },
    [broadcastTrackChange]
  );

  const value: CollabValue = {
    enabled, connected, online, messages, lastChange, revision,
    sendChat, addTrack, removeTrack, reorderTrack,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
