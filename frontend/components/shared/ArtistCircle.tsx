'use client';

import React from 'react';
import { SearchArtist } from '@/lib/api/mappers';
import Image from 'next/image';
import Link from 'next/link';

interface ArtistCircleProps {
  artist: SearchArtist;
}

export const ArtistCircle: React.FC<ArtistCircleProps> = ({ artist }) => {
  const thumbnail = artist.thumbnail || '';

  return (
    <Link 
      href={`/artist/${artist.id}`}
      className="flex flex-col items-center p-3 rounded-lg hover:bg-zinc-800/60 transition-colors group text-center block"
    >
      <div className="relative aspect-square w-full mb-3 shadow-xl">
        {thumbnail ? (
          <Image 
            src={`/api/proxy/image?url=${encodeURIComponent(thumbnail)}`}
            alt={artist.name}
            fill
            className="object-cover rounded-full shadow-lg"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 rounded-full" />
        )}
      </div>
      <h4 className="text-zinc-100 font-bold truncate text-sm w-full">{artist.name}</h4>
      <p className="text-zinc-400 text-xs uppercase tracking-wider font-medium mt-1">Artist</p>
    </Link>
  );
};
