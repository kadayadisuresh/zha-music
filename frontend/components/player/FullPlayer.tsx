"use client";

import React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MoreVertical, ThumbsUp, ThumbsDown, Download } from "lucide-react";
import { usePlaybackStore } from "@/lib/stores/playbackStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { useDownloadStore } from "@/lib/stores/downloadStore";
import { PlayerControls } from "./PlayerControls";
import { ProgressBar } from "./ProgressBar";
import { useAdaptiveColor } from "@/lib/hooks/useAdaptiveColor";
import { AdaptiveBackground } from "@/components/ui/AdaptiveBackground";
import { Button } from "@/components/ui/Button";
import { formatTime, cn } from "@/lib/utils";
import { QueueList } from "../queue/QueueList";
import { LyricsView } from "./LyricsView";
import { TrackContextMenu } from "../shared/TrackContextMenu";
import { JamIndicator } from "@/components/jam/JamIndicator";

export const FullPlayer: React.FC = () => {
  const { currentTrack, currentTime, duration, toggleLikeTrack, isTrackLiked } = usePlaybackStore();
  const { isPlayerExpanded, setPlayerExpanded } = useUIStore();
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
  const { startDownload, deleteDownload, isDownloaded, isDownloading, activeDownloads, initialize } = useDownloadStore();

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  const [activeTab, setActiveTab] = React.useState<'up-next' | 'lyrics' | 'related'>('up-next');
  const [isDisliked, setIsDisliked] = React.useState(false);
  const color = useAdaptiveColor(currentTrack?.thumbnail);

  if (!currentTrack) return null;

  const handleDismiss = () => setPlayerExpanded(false);
  const isLiked = isTrackLiked(currentTrack.id);

  return (
    <>
      <AnimatePresence>
        {isPlayerExpanded && (
          <motion.div
            key="full-player"
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
              <div className="flex-1 flex items-center justify-center md:justify-start gap-3 md:px-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Now Playing</h2>
                <div onClick={(e) => e.stopPropagation()}>
                  <JamIndicator />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-white hidden md:flex">
                <ChevronDown size={24} />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  // Opens a bottom sheet (position is ignored in sheet mode).
                  setContextMenu({ x: 0, y: 0 });
                }}
              >
                <MoreVertical size={24} />
              </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {activeTab === 'up-next' ? (
                  <motion.div
                    key="queue"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-6 md:p-8"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white">Up Next</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-primary font-bold uppercase tracking-wider"
                        onClick={() => {/* TODO: Implement Clear Queue */}}
                      >
                        Clear
                      </Button>
                    </div>
                    <QueueList />
                  </motion.div>
                ) : activeTab === 'lyrics' ? (
                  <motion.div
                    key="lyrics"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="h-full overflow-hidden p-6 md:p-8"
                  >
                    <LyricsView />
                  </motion.div>
                ) : (
                  /* Now Playing (Default/Related placeholder) */
                  <motion.div
                    key="now-playing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center p-6 md:p-8 gap-6 md:gap-8 h-full"
                  >
                    {/* Album Art */}
                    <motion.div 
                      layoutId="player-thumb"
                      className="relative aspect-square w-full max-w-[320px] md:max-w-full shadow-2xl shadow-black/50 overflow-hidden rounded-lg"
                    >
                      <Image 
                        src={currentTrack.thumbnail || '/placeholder-album.png'} 
                        alt={currentTrack.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </motion.div>

                    {/* Metadata & Actions */}
                    <div className="w-full flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
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
                          {currentTrack && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={cn(
                                "p-2 transition-colors", 
                                isDownloaded(currentTrack.id) 
                                  ? "text-green-500 hover:text-green-400" 
                                  : isDownloading(currentTrack.id) 
                                    ? "text-red-500 hover:text-red-400" 
                                    : "text-zinc-400 hover:text-white"
                              )}
                              onClick={() => {
                                if (isDownloaded(currentTrack.id)) {
                                  deleteDownload(currentTrack.id);
                                } else if (!isDownloading(currentTrack.id)) {
                                  startDownload(currentTrack);
                                }
                              }}
                            >
                              {isDownloading(currentTrack.id) ? (
                                <span className="text-[10px] font-bold">{activeDownloads[currentTrack.id] || 0}%</span>
                              ) : (
                                <Download size={20} fill={isDownloaded(currentTrack.id) ? "currentColor" : "none"} />
                              )}
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("p-2 transition-colors", isDisliked ? "text-red-500 hover:text-red-400" : "text-zinc-400 hover:text-white")}
                            onClick={() => {
                              setIsDisliked(!isDisliked);
                              if (isLiked) toggleLikeTrack(currentTrack);
                            }}
                          >
                            <ThumbsDown size={20} fill={isDisliked ? "currentColor" : "none"} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("p-2 transition-colors", isLiked ? "text-[#2E7DF7] hover:text-[#2E7DF7]/80" : "text-zinc-400 hover:text-white")}
                            onClick={() => {
                              toggleLikeTrack(currentTrack);
                              if (isDisliked) setIsDisliked(false);
                            }}
                          >
                            <ThumbsUp size={20} fill={isLiked ? "currentColor" : "none"} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Controls & Progress Area */}
            <div className="p-6 md:p-8 flex flex-col gap-6 bg-gradient-to-t from-black/80 to-transparent shrink-0" onClick={(e) => e.stopPropagation()}>
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
                <button 
                  onClick={() => setActiveTab('up-next')}
                  className={cn(activeTab === 'up-next' ? "text-white" : "hover:text-white transition-colors")}
                >
                  Up Next
                </button>
                <button 
                  onClick={() => setActiveTab('lyrics')}
                  className={cn(activeTab === 'lyrics' ? "text-white" : "hover:text-white transition-colors")}
                >
                  Lyrics
                </button>
                <button 
                  onClick={() => setActiveTab('related')}
                  className={cn(activeTab === 'related' ? "text-white" : "hover:text-white transition-colors")}
                >
                  Related
                </button>
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
      {contextMenu && currentTrack && (
        <TrackContextMenu
          track={currentTrack}
          variant="sheet"
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onNavigate={handleDismiss}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};
