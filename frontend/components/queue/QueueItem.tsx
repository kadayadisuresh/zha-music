'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import Image from 'next/image';
import { Track } from '@/lib/stores/playbackStore';
import { cn, formatTime } from '@/lib/utils';

interface QueueItemProps {
  track: Track;
  index: number;
  isActive: boolean;
  onRemove: (index: number) => void;
  onPlay: (track: Track, index: number) => void;
}

export const QueueItem: React.FC<QueueItemProps> = ({
  track,
  index,
  isActive,
  onRemove,
  onPlay,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.queueId || `fallback-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 p-2 rounded-md hover:bg-white/10 transition-colors',
        isActive && 'bg-white/10',
        isDragging && 'opacity-50 cursor-grabbing bg-white/20'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 p-1"
      >
        <GripVertical size={18} />
      </div>

      <div 
        className="relative w-10 h-10 flex-shrink-0 cursor-pointer overflow-hidden rounded shadow-md"
        onClick={() => onPlay(track, index)}
      >
        {track.thumbnail && (
          <Image
            src={track.thumbnail}
            alt={track.title}
            fill
            className="object-cover"
            sizes="40px"
          />
        )}
        {isActive && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-4 h-4 flex items-end justify-between px-0.5">
               <div className="w-0.5 h-full bg-primary animate-[bounce_1s_infinite]" />
               <div className="w-0.5 h-3/4 bg-primary animate-[bounce_1.2s_infinite]" />
               <div className="w-0.5 h-1/2 bg-primary animate-[bounce_0.8s_infinite]" />
            </div>
          </div>
        )}
      </div>

      <div 
        className="flex-grow min-w-0 cursor-pointer"
        onClick={() => onPlay(track, index)}
      >
        <p className={cn(
          "text-sm font-medium truncate",
          isActive ? "text-primary" : "text-white"
        )}>
          {track.title}
        </p>
        <p className="text-xs text-white/50 truncate">
          {track.artists.map(a => a.name).join(', ')}
        </p>
      </div>

      <div className="text-xs text-white/40 tabular-nums">
        {track.duration ? formatTime(track.duration) : '--:--'}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-all"
      >
        <X size={16} />
      </button>
    </div>
  );
};
