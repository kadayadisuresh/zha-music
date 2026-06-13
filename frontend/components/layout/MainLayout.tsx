'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { cn } from '@/lib/utils';

export function MainLayout({ children }: { children: React.ReactNode }) {
  // We no longer block the entire layout on isLoading.
  // The layout frame should be persistent and render immediately.

  // Reserve bottom space for the desktop mini player AND, on mobile, the
  // bottom navigation bar (always) + mini player (when a track is playing).
  const hasTrack = usePlaybackStore((s) => !!s.currentTrack);

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className={cn('flex-1', hasTrack ? 'pb-[140px] md:pb-[72px]' : 'pb-20 md:pb-0')}>
          {children}
        </main>
      </div>
    </div>
  );
}
