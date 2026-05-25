'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchResult, Track, Album, Artist } from '@/lib/api/mappers';
import { SearchSkeleton } from '@/components/search/SearchSkeleton';
import { TrackItem } from '@/components/shared/TrackItem';
import { AlbumCard } from '@/components/shared/AlbumCard';
import { ArtistCircle } from '@/components/shared/ArtistCircle';
import { SearchBar } from '@/components/search/SearchBar';
import Image from 'next/image';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const songs = results?.items.filter(item => item.item_type === 'track') as Track[] || [];
  const albums = results?.items.filter(item => item.item_type === 'album') as Album[] || [];
  const artists = results?.items.filter(item => item.item_type === 'artist') as Artist[] || [];

  const getTopResultTitle = (item: Track | Album | Artist) => {
    if (item.item_type === 'track') return item.title;
    return item.name;
  };

  const getTopResultArtists = (item: Track | Album | Artist) => {
    if (item.item_type === 'artist') return [];
    return item.artists;
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white p-6 pb-24">
      <div className="mb-8 flex justify-center">
        <SearchBar isLoading={isLoading} />
      </div>

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
          {/* Top Result */}
          {results.top_result && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Top Result</h2>
              <div className="bg-zinc-900/40 p-6 rounded-xl flex gap-8 items-center hover:bg-zinc-800/40 transition-colors">
                <div className="relative w-40 h-40 flex-shrink-0 shadow-2xl">
                  {results.top_result.thumbnails[0]?.url ? (
                    <Image 
                      src={`/api/proxy/image?url=${encodeURIComponent(results.top_result.thumbnails[0].url)}`}
                      alt={getTopResultTitle(results.top_result)}
                      fill
                      className={`object-cover ${results.top_result.item_type === 'artist' ? 'rounded-full' : 'rounded-lg'}`}
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 rounded-lg" />
                  )}
                </div>
                <div className="flex-1">
                   <h3 className="text-4xl font-black mb-2">{getTopResultTitle(results.top_result)}</h3>
                   <div className="text-zinc-400 font-medium">
                      {results.top_result.item_type === 'artist' ? 'Artist' : 
                       results.top_result.item_type === 'album' ? 'Album' : 'Song'}
                      {results.top_result.item_type !== 'artist' && (
                        <>
                          {' • '}
                          {getTopResultArtists(results.top_result).map((a) => a.name).join(', ')}
                        </>
                      )}
                   </div>
                   <button className="mt-6 bg-blue-500 hover:bg-blue-400 text-white px-8 py-3 rounded-full font-bold transition-all transform hover:scale-105 shadow-lg">
                      Play Now
                   </button>
                </div>
              </div>
            </section>
          )}

          {/* Songs */}
          {songs.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Songs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                {songs.slice(0, 10).map((song) => (
                  <TrackItem key={song.id} track={song} />
                ))}
              </div>
            </section>
          )}

          {/* Albums */}
          {albums.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Albums</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {albums.slice(0, 6).map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            </section>
          )}

          {/* Artists */}
          {artists.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Artists</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {artists.slice(0, 6).map((artist) => (
                  <ArtistCircle key={artist.id} artist={artist} />
                ))}
              </div>
            </section>
          )}

          {results.items.length === 0 && (
             <div className="text-center py-20 text-zinc-500">
                No results found for &quot;{query}&quot;
             </div>
          )}
        </div>
      )}
    </div>
  );
}
