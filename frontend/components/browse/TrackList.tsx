'use client';

import React, { useState } from 'react';
import { Track } from '@/lib/api/mappers';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { TrackContextMenu } from '../shared/TrackContextMenu';

interface TrackListProps {
  tracks: Track[];
}

export function TrackList({ tracks }: TrackListProps) {
  const { currentTrack, playTrack, setQueue } = usePlaybackStore();
  const [contextMenu, setContextMenu] = useState<{ track: any; x: number; y: number } | null>(null);

  const handlePlay = (track: Track, index: number) => {
    setQueue(tracks);
    playTrack(track);
  };

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setContextMenu({
      track,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center px-4 py-2 text-zinc-500 text-sm border-b border-zinc-800 mb-2">
        <div className="w-10 text-center">#</div>
        <div className="flex-1">Title</div>
        <div className="w-32 text-right">Duration</div>
      </div>
      
      <div className="flex flex-col">
        {tracks.map((track, index) => {
          const isActive = currentTrack?.id === track.id;
          
          return (
            <div 
              key={track.id}
              onClick={() => handlePlay(track, index)}
              onContextMenu={(e) => handleContextMenu(e, track)}
              className={`flex items-center px-4 py-3 hover:bg-zinc-800/50 rounded-md cursor-pointer group transition-colors ${isActive ? 'bg-zinc-800/80 text-blue-400' : 'text-zinc-200'}`}
            >
              <div className="w-10 text-center text-zinc-500 group-hover:hidden">
                {isActive ? (
                   <span className="text-blue-400">
                     <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current inline">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                     </svg>
                   </span>
                ) : index + 1}
              </div>
              <div className="w-10 text-center hidden group-hover:block">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current inline">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${isActive ? 'text-blue-400' : 'text-white'}`}>
                  {track.title}
                </div>
                <div className="text-sm text-zinc-500 truncate">
                  {track.artists.map(a => a.name).join(', ')}
                </div>
              </div>
              
              <div className="w-32 text-right text-zinc-500 text-sm tabular-nums">
                {formatDuration(track.duration)}
              </div>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <TrackContextMenu
          track={contextMenu.track}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
