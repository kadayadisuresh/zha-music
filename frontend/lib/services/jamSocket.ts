// Native WebSocket client for Jam sessions (host-controlled real-time playback
// + queue add + presence + clock sync). One instance per active jam. The
// httpOnly access_token cookie rides along on the handshake automatically.

export interface JamParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  role: "host" | "guest";
}

export interface JamPlaybackEvent {
  trackId: string | null;
  track?: any | null;
  positionMs: number;
  isPlaying: boolean;
  serverTimeMs: number;
  actor?: string;
}

export interface JamChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  text: string;
  createdAt: string;
}

export interface JamSyncState {
  currentTrackId: string | null;
  track?: any | null;
  positionMs: number;
  isPlaying: boolean;
  serverTimeMs: number;
  participants: JamParticipant[];
}

type Handlers = {
  onSyncState?: (s: JamSyncState) => void;
  onPlayback?: (kind: "play" | "pause" | "seek" | "skip_next" | "skip_prev", e: JamPlaybackEvent) => void;
  onParticipantJoin?: (p: JamParticipant) => void;
  onParticipantLeave?: (userId: string) => void;
  onQueueAdd?: (payload: any) => void;
  onQueueRemove?: (payload: any) => void;
  onSessionEnded?: () => void;
  onClockSync?: (t0: number, serverTimeMs: number, t3: number) => void;
  onChat?: (msg: JamChatMessage) => void;
  onStatus?: (connected: boolean) => void;
};

function wsBase(): string {
  // Match the host that served the page so jams work from any device/IP.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${host}:8000`;
    }
  }
  const raw = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "ws://localhost:8000";
  return raw.replace(/^http/, "ws");
}

export class JamSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private handlers: Handlers;
  private closedByUser = false;
  private retry = 0;
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  constructor(sessionId: string | number, handlers: Handlers) {
    this.sessionId = String(sessionId);
    this.handlers = handlers;
  }

  connect() {
    this.closedByUser = false;
    const ws = new WebSocket(`${wsBase()}/ws/jam/${this.sessionId}`);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.handlers.onStatus?.(true);
      // Kick off periodic clock sync for latency compensation.
      this.sendClockSync();
      this.clockTimer = setInterval(() => this.sendClockSync(), 10000);
    };

    ws.onmessage = (e) => {
      let evt: any;
      try {
        evt = JSON.parse(e.data);
      } catch {
        return;
      }
      const { type, payload } = evt;
      switch (type) {
        case "sync_state":
          this.handlers.onSyncState?.(payload);
          break;
        case "play":
        case "pause":
        case "seek":
        case "skip_next":
        case "skip_prev":
          this.handlers.onPlayback?.(type, payload);
          break;
        case "participant_join":
          this.handlers.onParticipantJoin?.(payload);
          break;
        case "participant_leave":
          this.handlers.onParticipantLeave?.(payload.userId);
          break;
        case "queue_add":
          this.handlers.onQueueAdd?.(payload);
          break;
        case "queue_remove":
          this.handlers.onQueueRemove?.(payload);
          break;
        case "session_ended":
          this.handlers.onSessionEnded?.();
          break;
        case "clock_sync":
          this.handlers.onClockSync?.(payload.t0, payload.serverTimeMs, Date.now());
          break;
        case "chat":
          this.handlers.onChat?.(payload);
          break;
      }
    };

    ws.onclose = (e) => {
      this.handlers.onStatus?.(false);
      if (this.clockTimer) {
        clearInterval(this.clockTimer);
        this.clockTimer = null;
      }
      if (this.closedByUser) return;
      // 1008 = policy violation: session ended, full, or not authorized.
      // Don't hammer a dead session — stop and report it as ended.
      if (e.code === 1008) {
        this.closedByUser = true;
        this.handlers.onSessionEnded?.();
        return;
      }
      const delay = Math.min(1000 * 2 ** this.retry, 30000);
      this.retry += 1;
      setTimeout(() => {
        if (!this.closedByUser) this.connect();
      }, delay);
    };

    ws.onerror = () => ws.close();
  }

  private send(obj: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private sendClockSync() {
    this.send({ type: "clock_sync", payload: { t0: Date.now() } });
  }

  // --- host controls ---
  play(trackId: string | null, positionMs: number, track?: any) {
    this.send({ type: "play", payload: { trackId, positionMs, track } });
  }
  pause(positionMs: number, track?: any) {
    this.send({ type: "pause", payload: { positionMs, track } });
  }
  seek(positionMs: number, track?: any) {
    this.send({ type: "seek", payload: { positionMs, track } });
  }
  skipNext(trackId: string | null, track?: any) {
    this.send({ type: "skip_next", payload: { trackId, track } });
  }
  skipPrev(trackId: string | null, track?: any) {
    this.send({ type: "skip_prev", payload: { trackId, track } });
  }
  queueRemove(queueId?: string, videoId?: string) {
    this.send({ type: "queue_remove", payload: { queueId, videoId } });
  }

  // --- anyone ---
  queueAdd(track: any) {
    this.send({ type: "queue_add", payload: { track, videoId: track?.id } });
  }
  requestSync() {
    this.send({ type: "sync_state", payload: {} });
  }
  sendChat(text: string) {
    this.send({ type: "chat", payload: { text } });
  }

  disconnect() {
    this.closedByUser = true;
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
