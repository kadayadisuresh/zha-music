'use client';

import React, { useEffect, useState, use } from 'react';
import { ArtistDetails } from '@/lib/api/mappers';
import { TrackItem } from '@/components/shared/TrackItem';
import { AlbumCard } from '@/components/shared/AlbumCard';
import { SharePopover } from '@/components/shared/SharePopover';
import { useUIStore } from '@/lib/stores/uiStore';
import Image from 'next/image';
import { Share } from 'lucide-react';

import { ArtistSkeleton } from '@/components/artist/ArtistSkeleton';

interface ArtistPageProps {
  params: Promise<{ id: string }>;
}

export default function ArtistPage({ params }: ArtistPageProps) {
  const { id } = use(params);
  const [artist, setArtist] = useState<ArtistDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setActiveThumbnail = useUIStore((state) => state.setActiveThumbnail);

  useEffect(() => {
    const fetchArtist = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/browse/artist/${id}`);
        if (!res.ok) throw new Error('Failed to fetch artist details');
        const data: ArtistDetails = await res.json();
        setArtist(data);
        
        // Set thumbnail for adaptive background
        if (data.header_thumbnail || data.thumbnail) {
          setActiveThumbnail(data.header_thumbnail || data.thumbnail || null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtist();

    // Reset background when leaving
    return () => setActiveThumbnail(null);
  }, [id, setActiveThumbnail]);

  if (isLoading) {
    return <ArtistSkeleton />;
  }

  if (error || !artist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <p className="text-red-500 mb-4">{error || 'Artist not found'}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="relative h-[40vh] min-h-[300px] w-full">
        <div className="absolute inset-0 z-0">
          {artist.header_thumbnail || artist.thumbnail ? (
            <Image
              src={artist.header_thumbnail || artist.thumbnail || ''}
              alt={artist.name}
              fill
              className="object-cover opacity-60"
              priority
            />
          ) : (
            <div className="w-full h-full bg-zinc-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>
        
        <div className="absolute bottom-0 left-0 p-8 z-10 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-6 mb-4">
            <h1 className="text-6xl md:text-8xl font-black truncate">{artist.name}</h1>
            <SharePopover 
              options={{ 
                title: artist.name, 
                text: `Check out ${artist.name}`, 
                url: typeof window !== 'undefined' ? window.location.href : '' 
              }}
              align="left"
              side="top"
            >
              <button className="p-3 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-colors pointer-events-none">
                <Share size={24} />
              </button>
            </SharePopover>
          </div>
          {artist.description && (
            <p className="text-zinc-300 max-w-2xl line-clamp-3 text-lg">{artist.description}</p>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-7xl mx-auto px-8 py-10 space-y-12">
        {artist.sections.map((section, idx) => {
          if (section.items.length === 0) return null;

          // Render differently based on section type or items content
          const isTracks = section.items[0]?.title && section.items[0]?.id && !section.items[0]?.year;
          const isAlbums = section.items[0]?.year;

          return (
            <section key={`${section.title}-${idx}`}>
              <h2 className="text-2xl font-bold mb-6">{section.title}</h2>
              
              {section.type === 'MusicShelf' || isTracks ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                  {section.items.slice(0, 10).map((track: any) => (
                    <TrackItem key={track.id} track={track} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {section.items.map((item: any) => (
                    <AlbumCard key={item.id} album={item} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
