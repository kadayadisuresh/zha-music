'use client';

import React, { useRef, useState, useEffect } from 'react';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { useJamStore } from '@/lib/stores/jamStore';
import { audioEngine } from '@/lib/audio/AudioEngine';
import { motion, useMotionValue, useTransform } from 'framer-motion';

interface ProgressBarProps {
  isMini?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ isMini = false }) => {
  const duration = usePlaybackStore((s) => s.duration);
  // In a Jam, only the host can scrub; guests follow the host's position.
  const isGuest = useJamStore((s) => s.active && !s.isHost);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // Progress as a motion value (0..1) driven imperatively — updating it does
  // not trigger React re-renders, so the fill animates on the compositor at
  // the audio engine's 60fps update rate without any spring lag.
  const progress = useMotionValue(0);
  const handleLeft = useTransform(progress, (v) => `${v * 100}%`);

  const posFromClientX = (clientX: number) => {
    const rect = progressBarRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  // Follow playback. usePlaybackStore.subscribe fires whenever currentTime
  // updates (~60fps while playing); we skip updates mid-drag so the user's
  // scrub position isn't overwritten.
  useEffect(() => {
    const sync = () => {
      if (isDraggingRef.current) return;
      const { currentTime, duration } = usePlaybackStore.getState();
      progress.set(duration ? Math.min(1, currentTime / duration) : 0);
    };
    sync();
    return usePlaybackStore.subscribe(sync);
  }, [progress]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (duration === 0 || isGuest) return;
    setIsDragging(true);
    isDraggingRef.current = true;
    progress.set(posFromClientX(e.clientX));
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      progress.set(posFromClientX(e.clientX));
    };
    const handleMouseUp = (e: MouseEvent) => {
      const pos = posFromClientX(e.clientX);
      if (duration > 0) audioEngine.seek(pos * duration);
      setIsDragging(false);
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, progress]);

  return (
    <div
      className={`relative w-full group ${isGuest ? 'cursor-default' : 'cursor-pointer'} ${isMini ? 'h-[3px]' : 'h-1 py-4'}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseDown={onMouseDown}
      ref={progressBarRef}
    >
      {/* Background track */}
      <div className={`absolute inset-0 bg-white/10 ${isMini ? '' : 'top-1/2 -translate-y-1/2 h-1 rounded-full'}`} />

      {/* Progress track */}
      <motion.div
        className={`absolute inset-0 bg-red-600 origin-left ${isMini ? '' : 'top-1/2 -translate-y-1/2 h-1 rounded-full'}`}
        style={{ scaleX: progress }}
      />

      {/* Scrub handle - only for non-mini or on hover */}
      {(!isMini || isHovering || isDragging) && (
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full -ml-1.5 shadow-md"
          style={{ left: handleLeft }}
          initial={{ scale: 0 }}
          animate={{ scale: isHovering || isDragging ? 1 : 0 }}
          transition={{ duration: 0.1 }}
        />
      )}

      {/* Invisible larger hit area for mini player */}
      {isMini && (
        <div className="absolute -top-2 bottom-0 left-0 right-0 z-10" />
      )}
    </div>
  );
};
