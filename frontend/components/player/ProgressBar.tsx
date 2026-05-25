'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { audioEngine } from '@/lib/audio/AudioEngine';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  isMini?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ isMini = false }) => {
  const { currentTime, duration } = usePlaybackStore();
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const progress = isDragging ? dragProgress : (currentTime / duration) || 0;

  const handleSeek = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!progressBarRef.current || duration === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    if (isDragging) {
      setDragProgress(pos);
    } else {
      audioEngine.seek(pos * duration);
    }
  }, [duration, isDragging]);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e);
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        const rect = progressBarRef.current?.getBoundingClientRect();
        if (!rect || duration === 0) return;
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setDragProgress(pos);
      };

      const handleMouseUp = (e: MouseEvent) => {
        const rect = progressBarRef.current?.getBoundingClientRect();
        if (rect && duration > 0) {
          const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          audioEngine.seek(pos * duration);
        }
        setIsDragging(false);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, duration]);

  return (
    <div 
      className={`relative w-full cursor-pointer group ${isMini ? 'h-[3px]' : 'h-1 py-4'}`}
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
        transition={{ type: 'spring', bounce: 0, duration: isDragging ? 0 : 0.1 }}
      />

      {/* Scrub handle - only for non-mini or on hover */}
      {(!isMini || isHovering || isDragging) && (
        <motion.div 
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full -ml-1.5 shadow-md"
          style={{ left: `${progress * 100}%` }}
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
