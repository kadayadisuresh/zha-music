import { useUserStore } from "@/lib/stores/userStore";
import type { Track } from "@/lib/stores/playbackStore";
import * as sb from "@/lib/supabase/data";

export type RecentTrack = sb.RecentTrack;

/**
 * Record a play (fire-and-forget). No-op when logged out. Phase 17: writes to
 * Supabase play_history via supabase-js (RLS), replacing the FastAPI endpoint.
 */
export function recordPlay(track: Track): void {
  if (!useUserStore.getState().user) return;
  if (!track?.id) return;

  sb.recordPlay({
    video_id: track.id,
    title: track.title || "Unknown",
    artist: (track.artists || []).map((a) => a.name).join(", ") || "Unknown",
    thumbnail_url: track.thumbnail || null,
  }).catch(() => {
    /* play recording is non-critical */
  });
}

export async function getRecentlyPlayed(limit = 20): Promise<RecentTrack[]> {
  if (!useUserStore.getState().user) return [];
  try {
    return await sb.getRecentlyPlayed(limit);
  } catch {
    return [];
  }
}
