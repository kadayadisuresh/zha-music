"use client";

// Headless: when the local user is the Jam host, mirror their playback to the
// session (play/pause/track-change immediately, plus a periodic position
// heartbeat that also covers manual seeks). Mounted once in the root layout.

import { useEffect } from "react";
import { usePlaybackStore } from "@/lib/stores/playbackStore";
import { useJamStore } from "@/lib/stores/jamStore";

export function JamController() {
  const isHost = useJamStore((s) => s.isHost);
  const active = useJamStore((s) => s.active);
  const connected = useJamStore((s) => s.connected);
  const resumeJam = useJamStore((s) => s.resumeJam);

  // On first load, rejoin a jam left in localStorage (survives page refresh).
  useEffect(() => {
    resumeJam();
  }, [resumeJam]);

  useEffect(() => {
    if (!isHost || !active) return;

    let prevPlaying = usePlaybackStore.getState().isPlaying;
    let prevTrackId = usePlaybackStore.getState().currentTrack?.id ?? null;

    const unsub = usePlaybackStore.subscribe((state) => {
      const jam = useJamStore.getState();
      const trackId = state.currentTrack?.id ?? null;

      if (trackId !== prevTrackId) {
        prevTrackId = trackId;
        prevPlaying = state.isPlaying;
        jam.broadcastTrack();
        return;
      }
      if (state.isPlaying !== prevPlaying) {
        prevPlaying = state.isPlaying;
        if (state.isPlaying) jam.broadcastPlay();
        else jam.broadcastPause();
      }
    });

    // Position heartbeat (covers seeks + drift correction for guests).
    const heartbeat = window.setInterval(() => {
      if (usePlaybackStore.getState().isPlaying) {
        useJamStore.getState().broadcastSeek();
      }
    }, 3000);

    return () => {
      unsub();
      window.clearInterval(heartbeat);
    };
  }, [isHost, active, connected]);

  return null;
}
