"use client";

import React, { useState, useEffect } from "react";
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
  Radio,
  Clock,
  Share,
  Download,
  Headphones,
  Heart
} from "lucide-react";
import { usePlaybackStore } from "@/lib/stores/playbackStore";
import { useDownloadStore } from "@/lib/stores/downloadStore";
import { useJamStore } from "@/lib/stores/jamStore";
import { Button } from "@/components/ui/Button";
import { SharePopover } from "@/components/shared/SharePopover";
import { SleepTimerModal } from "./SleepTimerModal";
import { JamIndicator } from "@/components/jam/JamIndicator";
import { cn } from "@/lib/utils";

interface PlayerControlsProps {
  variant?: "mini" | "mobileMini" | "full";
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ variant = "full" }) => {
  const { 
    isPlaying, 
    skipNext, 
    skipPrevious, 
    shuffleEnabled, 
    toggleShuffle, 
    repeatMode, 
    toggleRepeatMode,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    currentTrack,
    toggleLikeTrack,
    isTrackLiked,
    sleepTimerDuration,
    sleepTimerEndTime,
    startRadio
  } = usePlaybackStore();

  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [radioState, setRadioState] = useState<'idle' | 'loading' | 'added' | 'empty'>('idle');
  const [sleepRemaining, setSleepRemaining] = useState<string | null>(null);

  // Jam: guests can't drive playback (host-controlled). The headphones button
  // starts a jam, or opens the invite modal when one is already live.
  const jamActive = useJamStore((s) => s.active);
  const isJamHost = useJamStore((s) => s.isHost);
  const startJam = useJamStore((s) => s.startJam);
  const setShowInvite = useJamStore((s) => s.setShowInvite);
  const isGuest = jamActive && !isJamHost;

  // Live countdown for an active minute-based sleep timer (SRD 5.20)
  useEffect(() => {
    if (!sleepTimerEndTime) {
      setSleepRemaining(null);
      return;
    }
    const tick = () => {
      const ms = sleepTimerEndTime - Date.now();
      if (ms <= 0) {
        setSleepRemaining(null);
        return;
      }
      const total = Math.floor(ms / 1000);
      const m = Math.floor(total / 60);
      const s = total % 60;
      setSleepRemaining(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEndTime]);
  
  const { startDownload, deleteDownload, isDownloaded, isDownloading, activeDownloads, initialize } = useDownloadStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const volVal = typeof volume === 'number' && !isNaN(volume) ? volume : 1.0;
  const isMutedVal = !!isMuted;

  const handleTogglePlay = () => {
    if (isGuest) return; // host controls playback in a jam
    import('@/lib/audio/AudioEngine').then(({ audioEngine }) => {
      if (isPlaying) {
        audioEngine.pause();
      } else if (currentTrack) {
        audioEngine.play(currentTrack.id, currentTrack);
      }
    });
  };

  const handleJamButton = () => {
    if (jamActive) setShowInvite(true);
    else startJam();
  };

  const isLiked = currentTrack ? isTrackLiked(currentTrack.id) : false;
  const shareUrl = typeof window !== 'undefined' && currentTrack ? `${window.location.origin}/song/${currentTrack.id}` : '';

  const handleStartRadio = async () => {
    if (!currentTrack || radioState === 'loading') return;
    setRadioState('loading');
    const added = await startRadio();
    setRadioState(added > 0 ? 'added' : 'empty');
    setTimeout(() => setRadioState('idle'), 2500);
  };

  const radioTitle =
    radioState === 'loading' ? 'Starting radio…'
    : radioState === 'added' ? 'Radio started — added to Up Next'
    : radioState === 'empty' ? 'No radio tracks found'
    : 'Start radio';

  if (variant === "mobileMini") {
    // Spotify-style mobile mini player: connect/Jam · add-to-library · play/pause
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleJamButton}
          aria-label={jamActive ? "Jam session" : "Connect / Start a Jam"}
          className={cn("p-2", jamActive ? "text-[#2E7DF7]" : "text-zinc-200 hover:text-white")}
        >
          <Headphones size={20} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentTrack && toggleLikeTrack(currentTrack)}
          aria-label={isLiked ? "Remove from Liked Songs" : "Add to Liked Songs"}
          className={cn("p-2", isLiked ? "text-[#2E7DF7]" : "text-zinc-200 hover:text-white")}
        >
          <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTogglePlay}
          disabled={isGuest}
          aria-label={isPlaying ? "Pause" : "Play"}
          className={cn("text-white p-1", isGuest && "opacity-40 cursor-not-allowed")}
        >
          {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
        </Button>
      </div>
    );
  }

  if (variant === "mini") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={skipPrevious} disabled={isGuest} className={cn("text-zinc-400 hover:text-white", isGuest && "opacity-30 cursor-not-allowed")}>
          <SkipBack size={20} fill="currentColor" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTogglePlay}
          disabled={isGuest}
          className={cn("bg-white/10 hover:bg-white/20 text-white rounded-full p-2", isGuest && "opacity-40 cursor-not-allowed")}
        >
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={skipNext} disabled={isGuest} className={cn("text-zinc-400 hover:text-white", isGuest && "opacity-30 cursor-not-allowed")}>
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
          className={shuffleEnabled ? "text-[#2E7DF7]" : "text-zinc-400"}
        >
          <Shuffle size={20} />
        </Button>

        <div className="flex items-center gap-6">
          <Button variant="ghost" onClick={skipPrevious} disabled={isGuest} className={cn("text-white", isGuest && "opacity-30 cursor-not-allowed")}>
            <SkipBack size={28} fill="currentColor" />
          </Button>

          <Button
            variant="primary"
            onClick={handleTogglePlay}
            disabled={isGuest}
            title={isGuest ? "The host controls playback in this Jam" : undefined}
            className={cn("w-16 h-16 bg-[#2E7DF7] text-white hover:bg-[#2E7DF7]/90 rounded-full flex items-center justify-center", isGuest && "opacity-50 cursor-not-allowed")}
          >
            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </Button>

          <Button variant="ghost" onClick={skipNext} disabled={isGuest} className={cn("text-white", isGuest && "opacity-30 cursor-not-allowed")}>
            <SkipForward size={28} fill="currentColor" />
          </Button>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleRepeatMode}
          className={repeatMode !== 'off' ? "text-[#2E7DF7]" : "text-zinc-400"}
        >
          {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </Button>
      </div>

      {/* Volume Controls Row */}
      <div className="flex items-center gap-3 w-full px-1">
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={() => {
            const newMuted = !isMutedVal;
            import('@/lib/audio/AudioEngine').then(({ audioEngine }) => {
              audioEngine.setMuted(newMuted);
            });
          }}
          className="text-zinc-400 hover:text-white p-1"
        >
          {isMutedVal || volVal === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </Button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMutedVal ? 0 : volVal}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              import('@/lib/audio/AudioEngine').then(({ audioEngine }) => {
                audioEngine.setVolume(val);
                if (isMutedVal) {
                  audioEngine.setMuted(false);
                }
              });
            }
          }}
          className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-white hover:bg-zinc-500 transition-colors"
        />
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between gap-1 w-full border-t border-white/10 pt-4 px-1">
        {currentTrack && (
          <Button 
            type="button"
            variant="ghost" 
            size="sm" 
            className={cn(
              "p-2 transition-colors", 
              isDownloaded(currentTrack.id) 
                ? "text-green-500 hover:text-green-400" 
                : isDownloading(currentTrack.id) 
                  ? "text-[#2E7DF7] hover:text-[#5b9bff]" 
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
              <Download size={18} fill={isDownloaded(currentTrack.id) ? "currentColor" : "none"} />
            )}
          </Button>
        )}
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          onClick={() => currentTrack && toggleLikeTrack(currentTrack)}
          className={isLiked ? "text-[#2E7DF7] hover:text-[#2E7DF7]/80" : "text-zinc-400 hover:text-white"}
        >
          <ThumbsUp size={18} fill={isLiked ? "currentColor" : "none"} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsSleepModalOpen(true)}
          title={sleepRemaining ? `${sleepRemaining} remaining` : sleepTimerDuration === -1 ? 'Stops at end of track' : 'Sleep timer'}
          className={cn(
            "gap-1",
            sleepTimerDuration !== null ? "text-[#2E7DF7] hover:text-[#5b9bff]" : "text-zinc-400 hover:text-white"
          )}
        >
          <Clock size={18} />
          {sleepRemaining && (
            <span className="text-[10px] font-bold tabular-nums">{sleepRemaining}</span>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleStartRadio}
          disabled={!currentTrack}
          title={radioTitle}
          aria-label={radioTitle}
          className={cn(
            "transition-colors",
            radioState === 'loading' && "text-[#2E7DF7] animate-pulse",
            radioState === 'added' && "text-green-500",
            radioState === 'empty' && "text-zinc-500",
            radioState === 'idle' && "text-zinc-400 hover:text-white"
          )}
        >
          <Radio size={18} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleJamButton}
          title={jamActive ? "Jam session" : "Start a Jam"}
          aria-label={jamActive ? "Jam session" : "Start a Jam"}
          className={cn("transition-colors", jamActive ? "text-[#2E7DF7] hover:text-[#5b9bff]" : "text-zinc-400 hover:text-white")}
        >
          <Headphones size={18} />
        </Button>
        {currentTrack && (
          <SharePopover
            options={{ 
              title: currentTrack.title, 
              text: `Listen to ${currentTrack.title} by ${currentTrack.artists.map(a => a.name).join(', ')}`, 
              url: shareUrl 
            }}
            align="center"
            side="top"
          >
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
              <Share size={18} />
            </Button>
          </SharePopover>
        )}
      </div>

      <SleepTimerModal
        isOpen={isSleepModalOpen}
        onClose={() => setIsSleepModalOpen(false)}
      />
    </div>
  );
};
