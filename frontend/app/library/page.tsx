'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Library, Download, ChevronRight, Heart, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/lib/stores/userStore';
import { apiClient } from '@/lib/api/client';

interface LibraryItem {
  id: string;
  type: 'playlist' | 'album' | 'artist';
  title: string;
  subtitle: string;
  thumbnail_url: string | null;
}

const SHORTCUTS = [
  { href: '/downloads', icon: Download, title: 'Downloads', subtitle: 'Songs available offline', iconClass: 'text-[#2E7DF7] bg-[#2E7DF7]/15' },
  { href: '/playlist/liked', icon: Heart, title: 'Liked Songs', subtitle: 'Your favourite tracks', iconClass: 'text-pink-400 bg-pink-500/15' },
];

const FILTERS = [
  { id: 'playlist', label: 'Playlists' },
  { id: 'album', label: 'Albums' },
  { id: 'artist', label: 'Artists' },
] as const;

export default function LibraryPage() {
  const { user } = useUserStore();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'playlist' | 'album' | 'artist'>('all');

  const fetchLibraryData = async () => {
    if (user) {
      try {
        const data = await apiClient<LibraryItem[]>('/library/items');
        setItems(data);
      } catch (err) {
        console.warn('Failed to fetch library items:', err);
      }
      return;
    }

    // Guest: assemble from localStorage (mirrors the desktop sidebar).
    if (typeof window === 'undefined') return;
    const out: LibraryItem[] = [];

    const playlists = JSON.parse(localStorage.getItem('zha-local-playlists') || '[]');
    playlists.forEach((p: any) => out.push({ id: p.id, type: 'playlist', title: p.title, subtitle: 'Playlist • Local', thumbnail_url: null }));

    const albums = JSON.parse(localStorage.getItem('zha-local-liked-albums') || '[]');
    albums.forEach((a: any) => out.push({ id: a.album_id, type: 'album', title: a.title, subtitle: `Album • ${a.artist_name}`, thumbnail_url: a.thumbnail_url }));

    const artists = JSON.parse(localStorage.getItem('zha-local-followed-artists') || '[]');
    artists.forEach((art: any) => out.push({ id: art.channel_id, type: 'artist', title: art.name, subtitle: 'Artist', thumbnail_url: art.thumbnail_url }));

    setItems(out);
  };

  useEffect(() => {
    fetchLibraryData();
    const onUpdate = () => fetchLibraryData();
    window.addEventListener('library-update', onUpdate);
    return () => window.removeEventListener('library-update', onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  const hrefFor = (i: LibraryItem) =>
    i.type === 'playlist' ? `/playlist/${i.id}` : i.type === 'album' ? `/album/${i.id}` : `/artist/${i.id}`;

  return (
    <div className="p-6 md:p-8 max-w-screen-2xl mx-auto pb-32">
      <h1 className="text-3xl font-bold mb-6">Your Library</h1>

      {/* Quick access shortcuts */}
      <div className="space-y-2 mb-8">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 transition-colors group"
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${s.iconClass}`}>
              <s.icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold">{s.title}</p>
              <p className="text-zinc-400 text-xs">{s.subtitle}</p>
            </div>
            <ChevronRight size={20} className="text-zinc-500 group-hover:text-white transition-colors" />
          </Link>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
        {FILTERS.map((pill) => {
          const active = filter === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setFilter(active ? 'all' : pill.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold select-none transition-colors shrink-0',
                active ? 'bg-[#2E7DF7] text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              )}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 text-zinc-500">
          <Library size={40} className="mb-3 opacity-50" />
          <p className="font-semibold text-zinc-300">
            {filter === 'all' ? 'Your library is empty' : `No ${filter}s yet`}
          </p>
          <p className="text-sm mt-1">Save songs, albums and artists to build your collection.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              href={hrefFor(item)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900/70 transition-colors group"
            >
              <div
                className={cn(
                  'relative w-14 h-14 shrink-0 bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center',
                  item.type === 'artist' ? 'rounded-full' : 'rounded-md'
                )}
              >
                {item.thumbnail_url ? (
                  <Image
                    src={item.thumbnail_url}
                    alt={item.title}
                    fill
                    className={cn('object-cover', item.type === 'artist' ? 'rounded-full' : 'rounded-md')}
                    unoptimized
                  />
                ) : (
                  <Music2 size={20} className="text-zinc-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{item.title}</p>
                <p className="text-zinc-400 text-xs truncate capitalize">{item.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
