'use client';

import React, { useEffect, useState, use } from 'react';
import { AlbumDetails } from '@/lib/api/mappers';
import { TrackList } from '@/components/browse/TrackList';
import { useUIStore } from '@/lib/stores/uiStore';
import Image from 'next/image';
import Link from 'next/link';

interface AlbumPageProps {
  params: Promise<{ id: string }>;
}

export default function AlbumPage({ params }: AlbumPageProps) {
  const { id } = use(params);
  const [album, setAlbum] = useState<AlbumDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setActiveThumbnail = useUIStore((state) => state.setActiveThumbnail);

  useEffect(() => {
    const fetchAlbum = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/browse/album/${id}`);
        if (!res.ok) throw new Error('Failed to fetch album details');
        const data: AlbumDetails = await res.json();
        setAlbum(data);
        
        // Set thumbnail for adaptive background
        if (data.thumbnail) {
          setActiveThumbnail(data.thumbnail);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbum();

    // Reset background when leaving
    return () => setActiveThumbnail(null);
  }, [id, setActiveThumbnail]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <p className="text-red-500 mb-4">{error || 'Album not found'}</p>
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
      <div className="flex flex-col md:flex-row items-end gap-8 px-8 pt-20 pb-10 bg-gradient-to-b from-zinc-800/40 to-black">
        <div className="relative w-48 h-48 md:w-64 md:h-64 shadow-2xl flex-shrink-0">
          {album.thumbnail ? (
            <Image
              src={album.thumbnail}
              alt={album.title}
              fill
              className="object-cover rounded-md"
              priority
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 rounded-md" />
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold uppercase tracking-wider">Album</span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-2">{album.title}</h1>
          <div className="flex items-center gap-2 text-zinc-300">
            {album.artists.map((artist, i) => (
              <React.Fragment key={artist.id || artist.name}>
                <Link 
                  href={artist.id ? `/artist/${artist.id}` : '#'} 
                  className="hover:underline font-bold text-white"
                >
                  {artist.name}
                </Link>
                {i < album.artists.length - 1 && <span>•</span>}
              </React.Fragment>
            ))}
            {album.year && (
              <>
                <span className="text-zinc-500">•</span>
                <span>{album.year}</span>
              </>
            )}
            <span className="text-zinc-500">•</span>
            <span>{album.tracks.length} songs</span>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="max-w-7xl mx-auto px-8 py-10">
        <TrackList tracks={album.tracks} />
        
        {album.description && (
          <div className="mt-12 max-w-3xl">
            <h2 className="text-xl font-bold mb-4">About</h2>
            <p className="text-zinc-400 leading-relaxed whitespace-pre-wrap">
              {album.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
