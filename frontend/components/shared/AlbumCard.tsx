'use client';

import React from 'react';
import { Album } from '@/lib/api/mappers';
import Image from 'next/image';
import Link from 'next/link';

interface AlbumCardProps {
  album: Album;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album }) => {
  const thumbnail = album.thumbnails[0]?.url || '';

  return (
    <Link 
      href={`/album/${album.id}`}
      className="bg-zinc-900/40 p-3 rounded-lg hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="relative aspect-square w-full mb-3 shadow-lg">
        {thumbnail ? (
          <Image 
            src={`/api/proxy/image?url=${encodeURIComponent(thumbnail)}`}
            alt={album.name}
            fill
            className="object-cover rounded-md shadow-lg"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 rounded-md" />
        )}
        <div className="absolute bottom-2 right-2 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all shadow-xl">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <h4 className="text-zinc-100 font-bold truncate text-sm">{album.name}</h4>
      <p className="text-zinc-400 text-xs truncate">
        {album.year ? `${album.year} • ` : ''}{album.artists?.map(a => a.name).join(', ')}
      </p>
    </Link>
  );
};
