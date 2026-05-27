'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaybackStore } from '@/lib/stores/playbackStore';

interface ClientPlayerRedirectProps {
  videoId: string;
  trackData?: any;
  error?: string;
}

export default function ClientPlayerRedirect({ videoId, trackData, error }: ClientPlayerRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    if (error) {
      // We don't have a toast system specified, but usually it's alert or sonner.
      console.error(error);
      alert("Couldn't load shared song");
      router.replace('/');
      return;
    }

    // Set cookie as instructed
    if (trackData) {
      const expires = new Date(Date.now() + 5 * 60 * 1000).toUTCString();
      document.cookie = `zha-play-on-load=${encodeURIComponent(JSON.stringify(trackData))}; expires=${expires}; path=/`;
    }

    // Trigger playTrack as fallback/immediate
    const playTrack = usePlaybackStore.getState().playTrack;
    if (trackData) {
      playTrack(trackData);
    }

    router.replace('/');
  }, [videoId, trackData, error, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
    </div>
  );
}
