'use client';

import React from 'react';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { useUIStore } from '@/lib/stores/uiStore';
import { ProgressBar } from './ProgressBar';
import { PlayerControls } from './PlayerControls';
import { JamIndicator } from '@/components/jam/JamIndicator';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

export const MiniPlayer: React.FC = () => {
  const { currentTrack } = usePlaybackStore();
  const { isPlayerExpanded, setPlayerExpanded } = useUIStore();

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {!isPlayerExpanded && (
        <motion.div
          key="mini-player"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed z-50 bottom-[68px] left-2 right-2 rounded-xl overflow-hidden shadow-2xl md:bottom-0 md:left-0 md:right-0 md:rounded-none md:shadow-none bg-[#0b1120]/95 backdrop-blur-md border-t border-white/10 h-[60px] md:h-[72px]"
          onClick={() => setPlayerExpanded(true)}
        >
          <ProgressBar isMini={true} />

          <div className="flex items-center justify-between h-full px-3 md:px-4 max-w-screen-2xl mx-auto">
            {/* Metadata */}
            <div className="flex items-center gap-3 overflow-hidden flex-1">
              <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
                <Image 
                  src={currentTrack.thumbnail || '/placeholder-album.png'} 
                  alt={currentTrack.title}
                  fill
                  className="rounded object-cover shadow-lg"
                  unoptimized
                />
              </div>
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
            <div className="flex items-center gap-2 ml-2 md:ml-4" onClick={(e) => e.stopPropagation()}>
              {/* Desktop: prev / play / next with jam indicator */}
              <div className="hidden md:flex items-center gap-2">
                <JamIndicator compact />
                <PlayerControls variant="mini" />
              </div>
              {/* Mobile: Spotify-style connect · add · play/pause */}
              <div className="flex md:hidden">
                <PlayerControls variant="mobileMini" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
