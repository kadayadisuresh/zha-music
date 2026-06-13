'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchResult } from '@/lib/api/mappers';
import { SearchSkeleton } from '@/components/search/SearchSkeleton';
import { TrackItem } from '@/components/shared/TrackItem';
import { AlbumCard } from '@/components/shared/AlbumCard';
import { ArtistCircle } from '@/components/shared/ArtistCircle';
import { usePlaybackStore } from '@/lib/stores/playbackStore';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const playTrack = usePlaybackStore((state) => state.playTrack);
  
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setResults(null);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  return (
    <div className="flex flex-col min-h-screen bg-black text-white p-6 pb-24">

      {!query && (
        <div className="flex flex-col items-center justify-center flex-1 text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-xl">Search for your favorite music</p>
        </div>
      )}

      {query && isLoading && <SearchSkeleton />}

      {query && !isLoading && error && (
        <div className="text-red-500 text-center py-10">
          {error}
        </div>
      )}

      {query && !isLoading && !error && results && (
        <div className="space-y-10 max-w-7xl mx-auto w-full">
          {/* Songs */}
          {results.songs && results.songs.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Songs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              {results.songs.slice(0, 10).map((song, idx) => (
                  <TrackItem key={`${song.id}-${idx}`} track={song} onClick={() => playTrack(song)} />
                ))}
              </div>
            </section>
          )}

          {/* Albums */}
          {results.albums && results.albums.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Albums</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {results.albums.slice(0, 6).map((album, idx) => (
                  <AlbumCard key={`${album.id}-${idx}`} album={album} />
                ))}
              </div>
            </section>
          )}

          {/* Artists */}
          {results.artists && results.artists.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Artists</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {results.artists.slice(0, 6).map((artist, idx) => (
                  <ArtistCircle key={`${artist.id}-${idx}`} artist={artist} />
                ))}
              </div>
            </section>
          )}

          {(!results.songs || results.songs.length === 0) && 
           (!results.albums || results.albums.length === 0) && 
           (!results.artists || results.artists.length === 0) && (
             <div className="text-center py-20 text-zinc-500">
                No results found for &quot;{query}&quot;
             </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SearchContent />
    </Suspense>
  );
}
