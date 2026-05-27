'use client';

import React, { useEffect, useRef } from 'react';
import { Track, usePlaybackStore } from '@/lib/stores/playbackStore';
import { PlayCircle, PlusCircle, User, Disc, Share } from 'lucide-react';
import { SharePopover } from './SharePopover';

interface TrackContextMenuProps {
  track: Track;
  onClose: () => void;
  position: { x: number; y: number };
}

export function TrackContextMenu({ track, onClose, position }: TrackContextMenuProps) {
  const { addNext, addToQueue } = usePlaybackStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking inside a share popover
      const target = e.target as HTMLElement;
      if (target.closest('.share-popover-content')) return;

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Add event listener with a slight delay to avoid immediate closure if triggered by click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = typeof window !== 'undefined' ? Math.min(position.x, window.innerWidth - 240) : position.x;
  const adjustedY = typeof window !== 'undefined' ? Math.min(position.y, window.innerHeight - 200) : position.y;

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/song/${track.id}` : '';

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1"
      style={{ left: adjustedX, top: adjustedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-4 py-2 border-b border-zinc-800 mb-1 overflow-hidden">
        <div className="font-medium text-sm text-white truncate">{track.title}</div>
        <div className="text-xs text-zinc-500 truncate">{track.artists.map(a => a.name).join(', ')}</div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); addNext(track); onClose(); }}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <PlayCircle className="w-4 h-4 mr-3" />
        Play Next
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); addToQueue(track); onClose(); }}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <PlusCircle className="w-4 h-4 mr-3" />
        Add to Queue
      </button>

      <div className="h-px bg-zinc-800 my-1" />

      <SharePopover
        options={{ title: track.title, text: `Listen to ${track.title} by ${track.artists.map(a => a.name).join(', ')}`, url: shareUrl }}
        align="left"
        side="bottom"
      >
        <div className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors w-56">
          <Share className="w-4 h-4 mr-3" />
          Share
        </div>
      </SharePopover>

      <div className="h-px bg-zinc-800 my-1" />

      <button
        onClick={(e) => { e.stopPropagation(); /* Navigation logic would go here */ onClose(); }}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <User className="w-4 h-4 mr-3" />
        Go to Artist
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); /* Navigation logic would go here */ onClose(); }}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <Disc className="w-4 h-4 mr-3" />
        Go to Album
      </button>
    </div>
  );
}
