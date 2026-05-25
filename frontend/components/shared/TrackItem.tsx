'use client';

import React from 'react';
import { Track } from '@/lib/api/mappers';
import Image from 'next/image';

interface TrackItemProps {
  track: Track;
  onClick?: () => void;
  index?: number;
}

function formatDuration(seconds: number = 0): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const TrackItem: React.FC<TrackItemProps> = ({ track, onClick, index }) => {
  const thumbnail = track.thumbnail || '';

  return (
    <div 
      className="flex items-center gap-4 p-2 rounded-md hover:bg-zinc-800/50 group cursor-pointer transition-colors"
      onClick={onClick}
    >
      {index !== undefined && (
        <div className="w-8 text-right text-zinc-500 font-medium mr-1 group-hover:hidden">
          {index}
        </div>
      )}
      
      <div className="relative w-12 h-12 flex-shrink-0">
        {thumbnail ? (
          <Image 
            src={`/api/proxy/image?url=${encodeURIComponent(thumbnail)}`}
            alt={track.title}
            fill
            className="object-cover rounded"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 rounded" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-zinc-100 font-medium truncate">{track.title}</h4>
        <p className="text-zinc-400 text-sm truncate">
          {track.artists.map(a => a.name).join(', ')}
          {track.album?.name && ` • ${track.album.name}`}
        </p>
      </div>
      <div className="text-zinc-500 text-sm">
        {formatDuration(track.duration)}
      </div>
    </div>
  );
};
