'use client';

import React, { useEffect, useState, use } from 'react';
import { AlbumDetails } from '@/lib/api/mappers';
import { TrackList } from '@/components/browse/TrackList';
import { SharePopover } from '@/components/shared/SharePopover';
import { useUIStore } from '@/lib/stores/uiStore';
import Image from 'next/image';
import Link from 'next/link';
import { Share, Heart } from 'lucide-react';
import { useUserStore } from '@/lib/stores/userStore';
import * as sb from '@/lib/supabase/data';
import { cn } from '@/lib/utils';

interface AlbumPageProps {
  params: Promise<{ id: string }>;
}

export default function AlbumPage({ params }: AlbumPageProps) {
  const { id } = use(params);
  const [album, setAlbum] = useState<AlbumDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setActiveThumbnail = useUIStore((state) => state.setActiveThumbnail);
  const { user } = useUserStore();
  const [isLiked, setIsLiked] = useState(false);

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

  useEffect(() => {
    const checkLikedStatus = async () => {
      if (!album) return;
      if (user) {
        try {
          setIsLiked(await sb.isAlbumLiked(id));
        } catch (err) {
          console.error('Failed to check album liked status:', err);
        }
      } else {
        const localAlbumsRaw = localStorage.getItem('zha-local-liked-albums');
        const localAlbums = localAlbumsRaw ? JSON.parse(localAlbumsRaw) : [];
        const liked = localAlbums.some((a: any) => a.album_id === id);
        setIsLiked(liked);
      }
    };
    checkLikedStatus();
  }, [id, user, album]);

  const handleToggleLike = async () => {
    if (!album) return;
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);

    if (user) {
      try {
        if (nextLiked) {
          await sb.likeAlbum({
            album_id: id,
            title: album.title,
            artist_name: album.artists.map(a => a.name).join(', '),
            thumbnail_url: album.thumbnail,
          });
        } else {
          await sb.unlikeAlbum(id);
        }
        window.dispatchEvent(new CustomEvent('library-update'));
      } catch (err) {
        console.error('Failed to update album liked status on backend:', err);
        setIsLiked(!nextLiked); // revert state
      }
    } else {
      // Local fallback
      const localAlbumsRaw = localStorage.getItem('zha-local-liked-albums');
      let localAlbums = localAlbumsRaw ? JSON.parse(localAlbumsRaw) : [];
      if (nextLiked) {
        localAlbums.push({
          album_id: id,
          title: album.title,
          artist_name: album.artists.map(a => a.name).join(', '),
          thumbnail_url: album.thumbnail
        });
      } else {
        localAlbums = localAlbums.filter((a: any) => a.album_id !== id);
      }
      localStorage.setItem('zha-local-liked-albums', JSON.stringify(localAlbums));
      window.dispatchEvent(new CustomEvent('library-update'));
    }
  };

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
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 rounded-md" />
          )}
        </div>
        
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold uppercase tracking-wider">Album</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleToggleLike}
                className={cn(
                  "p-3 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-md transition-all active:scale-95",
                  isLiked ? "text-red-650" : "text-white"
                )}
              >
                <Heart size={24} fill={isLiked ? "currentColor" : "none"} className={cn(isLiked && "text-red-600 fill-red-600")} />
              </button>
              <SharePopover 
                options={{ 
                  title: album.title, 
                  text: `Check out the album ${album.title}`, 
                  url: typeof window !== 'undefined' ? window.location.href : '' 
                }}
                align="right"
                side="bottom"
              >
                <button className="p-3 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-colors pointer-events-none flex-shrink-0">
                  <Share size={24} />
                </button>
              </SharePopover>
            </div>
          </div>
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
