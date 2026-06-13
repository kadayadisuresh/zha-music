import { API_BASE_URL } from "@/lib/api/client";
import { useUserStore } from "@/lib/stores/userStore";
import type { Track } from "@/lib/stores/playbackStore";

export interface RecentTrack {
  video_id: string;
  title: string;
  artist: string;
  thumbnail_url: string | null;
  played_at: string | null;
}

/**
 * Record a play to the backend (fire-and-forget). No-op when logged out so we
 * never trigger apiClient's 401 redirect for anonymous listening.
 */
export function recordPlay(track: Track): void {
  if (!useUserStore.getState().user) return;
  if (!track?.id) return;

  const body = JSON.stringify({
    video_id: track.id,
    title: track.title || "Unknown",
    artist: (track.artists || []).map((a) => a.name).join(", ") || "Unknown",
    thumbnail_url: track.thumbnail || null,
    play_duration_seconds: 0,
  });

  fetch(`${API_BASE_URL}/users/me/history`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* play recording is non-critical */
  });
}

export async function getRecentlyPlayed(limit = 20): Promise<RecentTrack[]> {
  if (!useUserStore.getState().user) return [];
  try {
    const res = await fetch(
      `${API_BASE_URL}/users/me/recently-played?limit=${limit}`,
      { credentials: "include" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
