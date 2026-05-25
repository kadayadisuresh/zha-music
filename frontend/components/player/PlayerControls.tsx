"use client";

import React from "react";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Repeat, 
  Repeat1, 
  Shuffle, 
  Volume2, 
  VolumeX,
  ThumbsUp,
  MoreVertical,
  Radio,
  Clock
} from "lucide-react";
import { usePlaybackStore } from "@/lib/stores/playbackStore";
import { Button } from "@/components/ui/Button";

interface PlayerControlsProps {
  variant?: "mini" | "full";
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ variant = "full" }) => {
  const { 
    isPlaying, 
    setPlaying, 
    next, 
    previous, 
    shuffleEnabled, 
    toggleShuffle, 
    repeatMode, 
    toggleRepeatMode,
    volume,
    setVolume,
    isMuted,
    setIsMuted
  } = usePlaybackStore();

  const handleTogglePlay = () => setPlaying(!isPlaying);

  if (variant === "mini") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={previous} className="text-zinc-400 hover:text-white">
          <SkipBack size={20} fill="currentColor" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleTogglePlay}
          className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
        >
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={next} className="text-zinc-400 hover:text-white">
          <SkipForward size={20} fill="currentColor" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
      {/* Primary Controls */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleShuffle}
          className={shuffleEnabled ? "text-red-500" : "text-zinc-400"}
        >
          <Shuffle size={20} />
        </Button>

        <div className="flex items-center gap-6">
          <Button variant="ghost" onClick={previous} className="text-white">
            <SkipBack size={28} fill="currentColor" />
          </Button>
          
          <Button 
            variant="primary" 
            onClick={handleTogglePlay}
            className="w-16 h-16 bg-white text-black hover:bg-white/90 rounded-full flex items-center justify-center"
          >
            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </Button>

          <Button variant="ghost" onClick={next} className="text-white">
            <SkipForward size={28} fill="currentColor" />
          </Button>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleRepeatMode}
          className={repeatMode !== 'off' ? "text-red-500" : "text-zinc-400"}
        >
          {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </Button>
      </div>

      {/* Secondary Controls (Volume & Actions) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 group flex-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsMuted(!isMuted)}
            className="text-zinc-400 hover:text-white p-1"
          >
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>

        <div className="flex items-center gap-1">
           <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
            <ThumbsUp size={18} />
          </Button>
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
            <Clock size={18} />
          </Button>
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
            <Radio size={18} />
          </Button>
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
            <MoreVertical size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};
