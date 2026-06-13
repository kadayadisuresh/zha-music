// Native WebSocket client for collaborative playlists (sync + chat + presence).
// One instance per open playlist. The httpOnly access_token cookie is sent
// automatically on the handshake (localhost:3000 -> :8000 is same-site).

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  text: string;
  createdAt: string | null;
  clientMsgId?: string;
  pending?: boolean;
}

export interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

type Handlers = {
  onChat?: (msg: ChatMessage, clientMsgId?: string) => void;
  onPresence?: (u: PresenceUser & { state: "join" | "leave" }) => void;
  onSyncState?: (online: PresenceUser[]) => void;
  // Fired for track_added / track_removed / track_reordered / version_updated
  onTrackChange?: (kind: string, payload: any) => void;
  onStatus?: (connected: boolean) => void;
};

function wsBase(): string {
  // Match the host that served the page so collaboration works from any device/IP.
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

export class PlaylistSocket {
  private ws: WebSocket | null = null;
  private playlistId: string;
  private handlers: Handlers;
  private closedByUser = false;
  private retry = 0;

  constructor(playlistId: string, handlers: Handlers) {
    this.playlistId = playlistId;
    this.handlers = handlers;
  }

  connect() {
    this.closedByUser = false;
    const url = `${wsBase()}/ws/playlists/${this.playlistId}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.handlers.onStatus?.(true);
    };

    ws.onmessage = (e) => {
      let evt: any;
      try {
        evt = JSON.parse(e.data);
      } catch {
        return;
      }
      const { type, payload, clientMsgId } = evt;
      switch (type) {
        case "chat_message":
          this.handlers.onChat?.({ ...payload, clientMsgId }, clientMsgId);
          break;
        case "presence":
          this.handlers.onPresence?.(payload);
          break;
        case "sync_state":
          this.handlers.onSyncState?.(payload.online || []);
          break;
        case "track_added":
        case "track_removed":
        case "track_reordered":
        case "version_updated":
          this.handlers.onTrackChange?.(type, payload);
          break;
      }
    };

    ws.onclose = () => {
      this.handlers.onStatus?.(false);
      if (this.closedByUser) return;
      // Reconnect with backoff: 1s, 2s, 4s … capped at 30s
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

  sendChat(text: string, clientMsgId: string) {
    this.send({ type: "chat_message", payload: { text }, clientMsgId });
  }

  addTrack(songId: string, clientMsgId?: string) {
    this.send({ type: "add_track", payload: { songId }, clientMsgId });
  }

  removeTrack(songId: string, clientMsgId?: string) {
    this.send({ type: "remove_track", payload: { songId }, clientMsgId });
  }

  reorderTrack(songId: string, newPosition: number, clientMsgId?: string) {
    this.send({ type: "reorder_track", payload: { songId, newPosition }, clientMsgId });
  }

  sendTyping(isTyping: boolean) {
    this.send({ type: "typing", payload: { isTyping } });
  }

  disconnect() {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
  }
}
