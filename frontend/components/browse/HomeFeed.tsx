'use client';

import React, { useEffect, useState } from 'react';
import { TrackItem } from '../shared/TrackItem';
import { AlbumCard } from '../shared/AlbumCard';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { useUserStore } from '@/lib/stores/userStore';
import { getRecentlyPlayed } from '@/lib/services/userDataService';

interface HomeSection {
  title: string;
  items: any[];
}

export const HomeFeed = () => {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const playTrack = usePlaybackStore((state) => state.playTrack);
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    const fetchHome = async () => {
      try {
        const res = await fetch('/api/home');
        const data = await res.json();
        if (data.sections) {
          setSections(data.sections);
        }
      } catch (error) {
        console.warn('Failed to fetch home feed', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHome();
  }, []);

  // Recently played (logged-in users only) — maps backend rows to Track shape
  useEffect(() => {
    if (!user) {
      setRecent([]);
      return;
    }
    getRecentlyPlayed(12).then((rows) =>
      setRecent(
        rows.map((r) => ({
          id: r.video_id,
          title: r.title,
          artists: [{ name: r.artist }],
          thumbnail: r.thumbnail_url || undefined,
        }))
      )
    );
  }, [user]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-12">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="w-48 h-48 bg-zinc-800 rounded animate-pulse shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-12 pb-24 max-w-screen-2xl mx-auto">
      {recent.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-6 text-white tracking-tight">Recently Played</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-2">
            {recent.map((item: any, i: number) => (
              <TrackItem key={item.id + '-recent-' + i} track={item} onClick={() => playTrack(item)} />
            ))}
          </div>
        </section>
      )}

      {sections.map((section, idx) => (
        <section key={idx}>
          <h2 className="text-2xl font-bold mb-6 text-white tracking-tight">{section.title}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-2">
            {section.items.map((item: any, i: number) => {
              if (item.artists) { // It's a track
                return (
                  <TrackItem 
                    key={item.id + i} 
                    track={item} 
                    onClick={() => playTrack(item)} 
                  />
                );
              }
              return (
                <AlbumCard key={item.id + i} album={item} />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
