'use client';

import React from 'react';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { useUIStore } from '@/lib/stores/uiStore';
import { ProgressBar } from './ProgressBar';
import { Play, Pause, SkipForward, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioEngine } from '@/lib/audio/AudioEngine';

export const MiniPlayer: React.FC = () => {
  const { currentTrack, isPlaying, setPlaying, next } = usePlaybackStore();
  const { setPlayerExpanded } = useUIStore();

  if (!currentTrack) return null;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.resume();
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    next();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f]/95 backdrop-blur-md border-t border-white/10 z-50 h-[72px]"
        onClick={() => setPlayerExpanded(true)}
      >
        <ProgressBar isMini={true} />

        <div className="flex items-center justify-between h-full px-4 max-w-screen-2xl mx-auto">
          {/* Metadata */}
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            <img 
              src={currentTrack.thumbnail || '/placeholder-album.png'} 
              alt={currentTrack.title}
              className="w-12 h-12 rounded object-cover shadow-lg"
            />
            <div className="overflow-hidden">
              <h3 className="text-sm font-medium truncate text-white">
                {currentTrack.title}
              </h3>
              <p className="text-xs text-white/70 truncate">
                {currentTrack.artists.map(a => a.name).join(', ')}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 ml-4">
            <button 
              onClick={togglePlay}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <button 
              onClick={handleNext}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
            >
              <SkipForward size={24} fill="currentColor" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
