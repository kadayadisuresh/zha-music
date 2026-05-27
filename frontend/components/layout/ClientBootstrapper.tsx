'use client';

import { useEffect } from 'react';
import { usePlaybackStore } from '@/lib/stores/playbackStore';

export function ClientBootstrapper() {
  const playTrack = usePlaybackStore((state) => state.playTrack);

  useEffect(() => {
    const cookies = document.cookie.split(';');
    const playCookie = cookies.find(c => c.trim().startsWith('zha-play-on-load='));
    
    if (playCookie) {
      try {
        const value = playCookie.split('=')[1];
        const trackData = JSON.parse(decodeURIComponent(value));
        if (trackData) {
          playTrack(trackData);
        }
      } catch (e) {
        console.error('Failed to parse zha-play-on-load cookie', e);
      } finally {
        // Delete cookie
        document.cookie = 'zha-play-on-load=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
    }
  }, [playTrack]);

  return null;
}
