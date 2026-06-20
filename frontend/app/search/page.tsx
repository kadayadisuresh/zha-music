'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchResult } from '@/lib/api/mappers';
import { SearchSkeleton } from '@/components/search/SearchSkeleton';
import { TrackItem } from '@/components/shared/TrackItem';
import { AlbumCard } from '@/components/shared/AlbumCard';
import { ArtistCircle } from '@/components/shared/ArtistCircle';
import { usePlaybackStore } from '@/lib/stores/playbackStore';

/**
 * Detect a pasted YouTube link (or a bare 11-char video id) and return its video
 * id, else null. This lets the search box double as an "add by link" entry point:
 * /api/search only queries YouTube *Music*, so videos that exist on YouTube but
 * not in the Music catalog can't be found by searching — but they still play and
 * resolve by id, so a pasted link gets turned into a normal song result.
 */
function extractYouTubeVideoId(input: string): string | null {
  const q = input.trim();
  const ID = /^[a-zA-Z0-9_-]{11}$/;
  if (ID.test(q)) return q; // bare id pasted directly
  if (!/youtu\.?be/i.test(q)) return null; // only parse things that look like a YT link
  try {
    const url = new URL(q.startsWith('http') ? q : `https://${q}`);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return ID.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'music.youtube.com' || host.endsWith('.youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && ID.test(v)) return v;
      const m = url.pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a parseable URL — fall through
  }
  return null;
}

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
        // A pasted YouTube link/id resolves directly (bypasses YT Music search,
        // which can't find videos outside the Music catalog).
        const videoId = extractYouTubeVideoId(query);
        if (videoId) {
          const res = await fetch(`/api/innertube/track?video_id=${videoId}`);
          if (!res.ok) throw new Error("Couldn't load that YouTube link.");
          const track = await res.json();
          setResults({ songs: [track], albums: [], artists: [] });
          return;
        }

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
