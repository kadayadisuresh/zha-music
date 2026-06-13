'use client';

import React from 'react';
import { Heart, Play } from 'lucide-react';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { TrackItem } from '@/components/shared/TrackItem';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';

export default function LikedSongsPage() {
  const { likedTracks, playTrack, setQueue } = usePlaybackStore();

  const handlePlayAll = () => {
    if (likedTracks.length > 0) {
      setQueue(likedTracks);
      playTrack(likedTracks[0]);
    }
  };

  return (
    <div className="p-8 max-w-screen-2xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-8 text-center md:text-left">
        <div className="w-40 h-40 bg-gradient-to-br from-red-600 to-red-950 rounded-2xl shadow-2xl flex items-center justify-center relative group overflow-hidden">
          <Heart className="w-16 h-16 text-white fill-current group-hover:scale-110 transition-transform duration-300" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={handlePlayAll}>
            <Play className="w-12 h-12 text-white fill-current" />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-2">Playlist</p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-white">Liked Songs</h1>
          <p className="text-zinc-400 text-sm">
            {likedTracks.length} {likedTracks.length === 1 ? 'song' : 'songs'}
          </p>
        </div>
        {likedTracks.length > 0 && (
          <Button 
            onClick={handlePlayAll}
            className="bg-[#2E7DF7] hover:bg-[#1F5FD0] text-white font-bold px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
          >
            <Play size={18} fill="currentColor" />
            <span>Play All</span>
          </Button>
        )}
      </div>
      
      {likedTracks.length === 0 ? (
        <EmptyState 
          icon={<Heart className="w-12 h-12 text-zinc-600" />} 
          title="No liked songs" 
          description="Tap the heart icon on any track to add it to your Liked Songs." 
        />
      ) : (
        <div className="space-y-1">
          {likedTracks.map((track, index) => (
            <TrackItem 
              key={`${track.id}-${index}`} 
              track={track} 
              index={index + 1}
              onClick={() => {
                setQueue(likedTracks);
                playTrack(track);
              }} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
