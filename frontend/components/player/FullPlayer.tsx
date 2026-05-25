"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MoreVertical, ThumbsUp, ThumbsDown } from "lucide-react";
import { usePlaybackStore } from "@/lib/stores/playbackStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { PlayerControls } from "./PlayerControls";
import { ProgressBar } from "./ProgressBar";
import { useAdaptiveColor } from "@/lib/hooks/useAdaptiveColor";
import { AdaptiveBackground } from "@/components/ui/AdaptiveBackground";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/lib/utils";

export const FullPlayer: React.FC = () => {
  const { currentTrack, currentTime, duration } = usePlaybackStore();
  const { isPlayerExpanded, setPlayerExpanded } = useUIStore();
  const color = useAdaptiveColor(currentTrack?.thumbnail);

  if (!currentTrack) return null;

  const handleDismiss = () => setPlayerExpanded(false);

  return (
    <AnimatePresence>
      {isPlayerExpanded && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
          className="fixed inset-0 z-[60] flex flex-col md:flex-row-reverse"
        >
          {/* Overlay Background for Desktop - allows clicking outside to dismiss */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="hidden md:block absolute inset-0 bg-black/40 backdrop-blur-sm -z-10"
            onClick={handleDismiss}
          />

          <AdaptiveBackground color={color} />

          {/* Main Player Panel */}
          <motion.div 
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              // Mobile swipe down to dismiss
              if (info.offset.y > 100 && window.innerWidth < 768) {
                handleDismiss();
              }
            }}
            className="flex-1 flex flex-col h-full bg-black/60 backdrop-blur-3xl md:w-[380px] md:flex-none md:border-l md:border-white/10 md:shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 h-16 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-white md:hidden">
                <ChevronDown size={28} />
              </Button>
              <div className="flex-1 text-center md:text-left md:px-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Now Playing</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-white hidden md:flex">
                <ChevronDown size={24} />
              </Button>
              <Button variant="ghost" size="sm" className="text-white">
                <MoreVertical size={24} />
              </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 gap-6 md:gap-8 overflow-y-auto">
              {/* Album Art */}
              <motion.div 
                layoutId="player-thumb"
                className="relative aspect-square w-full max-w-[320px] md:max-w-full shadow-2xl shadow-black/50"
              >
                <img 
                  src={currentTrack.thumbnail || '/placeholder-album.png'} 
                  alt={currentTrack.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              </motion.div>

              {/* Metadata & Actions */}
              <div className="w-full flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl md:text-2xl font-bold text-white truncate">
                      {currentTrack.title}
                    </h1>
                    <p className="text-base md:text-lg text-white/70 truncate">
                      {currentTrack.artists.map(a => a.name).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white p-2">
                      <ThumbsDown size={20} />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white p-2">
                      <ThumbsUp size={20} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls & Progress Area */}
            <div className="p-6 md:p-8 flex flex-col gap-6 bg-gradient-to-t from-black/80 to-transparent shrink-0">
              <div className="flex flex-col gap-1">
                <ProgressBar />
                <div className="flex justify-between text-[10px] md:text-xs font-medium text-zinc-400 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              
              <PlayerControls variant="full" />
              
              {/* Bottom Navigation Tabs */}
              <div className="flex items-center justify-around text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-t border-white/5 pt-4">
                <button className="text-white">Up Next</button>
                <button className="hover:text-white transition-colors">Lyrics</button>
                <button className="hover:text-white transition-colors">Related</button>
              </div>
            </div>
          </motion.div>

          {/* Empty space on desktop for clicking through */}
          <div 
            className="hidden md:flex flex-1 h-full"
            onClick={handleDismiss}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
