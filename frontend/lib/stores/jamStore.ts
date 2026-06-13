import { create } from "zustand";
import { API_BASE_URL } from "@/lib/api/client";
import { JamSocket, JamParticipant, JamPlaybackEvent, JamSyncState, JamChatMessage } from "@/lib/services/jamSocket";
import { usePlaybackStore, Track } from "./playbackStore";

// One live socket per tab (kept outside React/zustand state).
let socket: JamSocket | null = null;

// Persist the active jam so a page refresh (or transient drop) can rejoin the
// same session instead of abandoning it — pairs with the server grace window.
const JAM_PERSIST_KEY = "zha-active-jam";

interface PersistedJam {
  sessionId: number;
  isHost: boolean;
  joinCode: string | null;
  inviteToken: string | null;
}

function persistJam(data: PersistedJam | null) {
  if (typeof window === "undefined") return;
  try {
    if (data) localStorage.setItem(JAM_PERSIST_KEY, JSON.stringify(data));
    else localStorage.removeItem(JAM_PERSIST_KEY);
  } catch {
    /* storage unavailable */
  }
}

// Only correct guest playback position when drift exceeds this (seconds), to
// avoid constant re-seeking on a streaming <audio> element.
const DRIFT_THRESHOLD_S = 1.5;

interface JamState {
  sessionId: number | null;
  joinCode: string | null;
  inviteToken: string | null;
  isHost: boolean;
  active: boolean;
  connected: boolean;
  participants: JamParticipant[];
  clockOffset: number; // serverTime - clientTime (ms)
  showInvite: boolean;
  endedNotice: boolean;
  currentJamTrackId: string | null;
  currentJamTrack: Track | null; // last-known track for the live jam (for guests)
  messages: JamChatMessage[];
  // Guests must make a user gesture before the browser allows audio playback.
  audioUnlocked: boolean;

  // lifecycle
  startJam: () => Promise<void>;
  joinSession: (sessionId: number, isHost: boolean, joinCode?: string) => void;
  resumeJam: () => void;
  guestListen: () => Promise<void>;
  endJam: () => Promise<void>;
  leaveJam: () => void;
  setShowInvite: (v: boolean) => void;
  dismissEnded: () => void;
  inviteLink: () => string;

  // host broadcast helpers (no-ops unless host + connected)
  broadcastPlay: () => void;
  broadcastPause: () => void;
  broadcastSeek: () => void;
  broadcastTrack: () => void;
  queueAdd: (track: Track) => void;
  sendChat: (text: string) => void;
}

function trackPayload(t: Track | null) {
  if (!t) return null;
  return { id: t.id, title: t.title, artists: t.artists, thumbnail: t.thumbnail, duration: t.duration };
}

export const useJamStore = create<JamState>((set, get) => {
  // --- guest: apply an authoritative remote playback event -----------------
  async function applyRemote(evt: JamPlaybackEvent, kind: string) {
    if (get().isHost) return; // host is the source of truth
    const { clockOffset, currentJamTrackId } = get();
    const serverNow = Date.now() + clockOffset;
    const elapsed = serverNow - (evt.serverTimeMs || serverNow);
    const targetSec = Math.max(0, (evt.positionMs + (evt.isPlaying ? elapsed : 0)) / 1000);

    const { audioEngine } = await import("@/lib/audio/AudioEngine");
    const ps = usePlaybackStore.getState();

    const trackChanged = !!evt.trackId && evt.trackId !== currentJamTrackId;
    if (trackChanged) {
      const track: Track = (evt.track as Track) || {
        id: evt.trackId as string,
        title: "Jam track",
        artists: [{ name: "—" }],
      };
      set({ currentJamTrackId: evt.trackId, currentJamTrack: track });
      await audioEngine.play(evt.trackId as string, track);
      // After load, snap to the right position; pause if host is paused.
      window.setTimeout(() => {
        audioEngine.seek(targetSec);
        if (!evt.isPlaying) audioEngine.pause();
      }, 300);
      return;
    }

    // Same track already loaded.
    if (!evt.isPlaying || kind === "pause") {
      audioEngine.pause();
      audioEngine.seek(targetSec);
    } else {
      const drift = Math.abs((ps.currentTime || 0) - targetSec);
      if (drift > DRIFT_THRESHOLD_S) audioEngine.seek(targetSec);
      if (!ps.isPlaying && evt.trackId) {
        audioEngine.play(evt.trackId, (evt.track as Track) || ps.currentTrack || undefined);
      }
    }
  }

  function connect(sessionId: number, isHost: boolean) {
    socket?.disconnect();
    socket = new JamSocket(sessionId, {
      onStatus: (connected) => set({ connected }),
      onSyncState: (s: JamSyncState) => {
        set({ participants: s.participants || [] });
        if (!get().isHost && s.currentTrackId) {
          applyRemote(
            { trackId: s.currentTrackId, track: s.track, positionMs: s.positionMs, isPlaying: s.isPlaying, serverTimeMs: s.serverTimeMs },
            "sync"
          );
        }
      },
      onPlayback: (kind, e) => applyRemote(e, kind),
      onParticipantJoin: (p) =>
        set((st) => (st.participants.some((x) => x.userId === p.userId) ? st : { participants: [...st.participants, p] })),
      onParticipantLeave: (userId) => set((st) => ({ participants: st.participants.filter((p) => p.userId !== userId) })),
      onQueueAdd: (payload) => {
        const t = payload?.track;
        if (t && t.id) usePlaybackStore.getState().addToQueue(t);
      },
      onQueueRemove: () => {},
      onSessionEnded: () => {
        // Guests get notified; hosts already know.
        const wasGuest = !get().isHost;
        socket?.disconnect();
        socket = null;
        set({
          sessionId: null,
          joinCode: null,
          inviteToken: null,
          isHost: false,
          active: false,
          connected: false,
          participants: [],
          currentJamTrackId: null,
          currentJamTrack: null,
          audioUnlocked: false,
          messages: [],
          endedNotice: wasGuest,
        });
        persistJam(null);
      },
      onClockSync: (t0, serverTimeMs, t3) => {
        const rtt = t3 - t0;
        const offset = serverTimeMs - (t0 + rtt / 2); // serverTime - client midpoint
        // Light smoothing toward the latest estimate.
        const prev = get().clockOffset;
        set({ clockOffset: prev === 0 ? offset : prev * 0.6 + offset * 0.4 });
      },
      onChat: (msg) => set((st) => ({ messages: [...st.messages, msg] })),
    });
    socket.connect();
  }

  return {
    sessionId: null,
    joinCode: null,
    inviteToken: null,
    isHost: false,
    active: false,
    connected: false,
    participants: [],
    clockOffset: 0,
    showInvite: false,
    endedNotice: false,
    currentJamTrackId: null,
    currentJamTrack: null,
    audioUnlocked: false,
    messages: [],

    startJam: async () => {
      const current = usePlaybackStore.getState().currentTrack;
      const qs = current ? `?track_id=${encodeURIComponent(current.id)}` : "";
      const res = await fetch(`${API_BASE_URL}/jam/start${qs}`, { method: "POST", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      set({
        sessionId: data.session_id,
        joinCode: data.join_code,
        inviteToken: data.invite_token,
        isHost: true,
        active: true,
        endedNotice: false,
        currentJamTrackId: current?.id ?? null,
        currentJamTrack: current ?? null,
        audioUnlocked: true, // host is already interacting
        messages: [],
        showInvite: true,
      });
      persistJam({ sessionId: data.session_id, isHost: true, joinCode: data.join_code, inviteToken: data.invite_token });
      connect(data.session_id, true);
      // Push the current playback state so late joiners get the right track.
      window.setTimeout(() => get().broadcastSeek(), 500);
    },

    joinSession: (sessionId, isHost, joinCode) => {
      set({
        sessionId,
        isHost,
        joinCode: joinCode ?? null,
        active: true,
        endedNotice: false,
        currentJamTrackId: null,
        currentJamTrack: null,
        audioUnlocked: isHost, // guests must tap to start audio
        messages: [],
      });
      persistJam({ sessionId, isHost, joinCode: joinCode ?? null, inviteToken: null });
      connect(sessionId, isHost);
    },

    resumeJam: () => {
      if (get().active || typeof window === "undefined") return;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(JAM_PERSIST_KEY);
      } catch {
        return;
      }
      if (!raw) return;
      try {
        const d = JSON.parse(raw) as PersistedJam;
        if (!d?.sessionId) return;
        set({
          sessionId: d.sessionId,
          isHost: !!d.isHost,
          joinCode: d.joinCode ?? null,
          inviteToken: d.inviteToken ?? null,
          active: true,
          endedNotice: false,
          currentJamTrackId: null,
          currentJamTrack: null,
          audioUnlocked: !!d.isHost,
          messages: [],
        });
        // If the session has ended, the socket gets a 1008 and self-cleans.
        connect(d.sessionId, !!d.isHost);
      } catch {
        persistJam(null);
      }
    },

    // Guest gesture: unlock browser audio and start playing the host's current
    // track. Browsers block programmatic audio until the user interacts.
    guestListen: async () => {
      if (get().isHost) return;
      set({ audioUnlocked: true });
      socket?.requestSync(); // pull the freshest position/track from the server
      const { currentJamTrackId, currentJamTrack } = get();
      if (currentJamTrackId) {
        const { audioEngine } = await import("@/lib/audio/AudioEngine");
        await audioEngine.play(currentJamTrackId, currentJamTrack || undefined);
      }
    },

    endJam: async () => {
      const { sessionId, isHost } = get();
      if (sessionId && isHost) {
        await fetch(`${API_BASE_URL}/jam/${sessionId}`, { method: "DELETE", credentials: "include" }).catch(() => {});
      }
      socket?.disconnect();
      socket = null;
      set({
        sessionId: null, joinCode: null, inviteToken: null, isHost: false,
        active: false, connected: false, participants: [], showInvite: false,
        currentJamTrackId: null, currentJamTrack: null, audioUnlocked: false, messages: [],
      });
      persistJam(null);
    },

    leaveJam: () => {
      socket?.disconnect();
      socket = null;
      set({
        sessionId: null, joinCode: null, inviteToken: null, isHost: false,
        active: false, connected: false, participants: [], showInvite: false,
        currentJamTrackId: null, currentJamTrack: null, audioUnlocked: false, messages: [],
      });
      persistJam(null);
    },

    setShowInvite: (v) => set({ showInvite: v }),
    dismissEnded: () => set({ endedNotice: false }),
    inviteLink: () => {
      const { inviteToken, joinCode } = get();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      return `${base}/jam/${inviteToken || joinCode || ""}`;
    },

    broadcastPlay: () => {
      const { isHost } = get();
      if (!isHost || !socket) return;
      const ps = usePlaybackStore.getState();
      socket.play(ps.currentTrack?.id ?? null, Math.round((ps.currentTime || 0) * 1000), trackPayload(ps.currentTrack));
    },
    broadcastPause: () => {
      const { isHost } = get();
      if (!isHost || !socket) return;
      const ps = usePlaybackStore.getState();
      socket.pause(Math.round((ps.currentTime || 0) * 1000), trackPayload(ps.currentTrack));
    },
    broadcastSeek: () => {
      const { isHost } = get();
      if (!isHost || !socket) return;
      const ps = usePlaybackStore.getState();
      socket.seek(Math.round((ps.currentTime || 0) * 1000), trackPayload(ps.currentTrack));
    },
    broadcastTrack: () => {
      const { isHost } = get();
      if (!isHost || !socket) return;
      const ps = usePlaybackStore.getState();
      if (ps.currentTrack) {
        set({ currentJamTrackId: ps.currentTrack.id });
        socket.skipNext(ps.currentTrack.id, trackPayload(ps.currentTrack));
      }
    },
    queueAdd: (track) => {
      socket?.queueAdd(trackPayload(track));
    },
    sendChat: (text) => {
      const clean = text.trim();
      if (!clean) return;
      socket?.sendChat(clean);
    },
  };
});
