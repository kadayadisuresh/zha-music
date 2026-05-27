'use client';

import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { useEffect, useState } from 'react';

export function PlaybackAnnouncer() {
  const { currentTrack } = usePlaybackStore();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (currentTrack) {
      setAnnouncement(`Now playing: ${currentTrack.title} by ${currentTrack.artists.map(a => a.name).join(', ')}`);
    } else {
      setAnnouncement('');
    }
  }, [currentTrack]);

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}
