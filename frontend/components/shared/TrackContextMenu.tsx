'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Track, usePlaybackStore } from '@/lib/stores/playbackStore';
import { PlayCircle, PlusCircle, User, Disc, Share, Download, Trash2, FolderPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SharePopover } from './SharePopover';
import { useDownloadStore } from '@/lib/stores/downloadStore';
import { usePlaylistStore } from '@/lib/stores/playlistStore';
import AddToPlaylistModal from './AddToPlaylistModal';
import { createPortal } from 'react-dom';

interface TrackContextMenuProps {
  track: Track;
  onClose: () => void;
  position: { x: number; y: number };
  playlistId?: number | string;
  onRemoveSuccess?: () => void;
  /** 'menu' = positioned dropdown (default); 'sheet' = bottom sheet (mobile). */
  variant?: 'menu' | 'sheet';
  /** Called when an item navigates away (e.g. Go to Artist/Album) — lets the
   *  caller dismiss an overlay like the full player so the new page is visible. */
  onNavigate?: () => void;
}

export function TrackContextMenu({ track, onClose, position, playlistId, onRemoveSuccess, variant = 'menu', onNavigate }: TrackContextMenuProps) {
  const router = useRouter();
  const { addNext, addToQueue } = usePlaybackStore();
  const { startDownload, deleteDownload, cancelDownload, isDownloaded, isDownloading, activeDownloads, initialize } = useDownloadStore();
  const { removeSongFromPlaylist } = usePlaylistStore();
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Sheet open state — lets the bottom sheet animate out (slide down) before
  // the component actually unmounts.
  const [sheetOpen, setSheetOpen] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss: for the sheet, trigger the slide-down exit; otherwise close now.
  const dismiss = () => {
    if (variant === 'sheet') setSheetOpen(false);
    else onClose();
  };

  useEffect(() => {
    initialize();
    setMounted(true);
  }, [initialize]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking inside a share popover or modal
      const target = e.target as HTMLElement;
      if (target.closest('.share-popover-content')) return;

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        dismiss();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, variant]);

  if (isAddToPlaylistOpen) {
    return (
      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        songId={track.id}
        onClose={() => {
          setIsAddToPlaylistOpen(false);
          onClose();
        }}
      />
    );
  }

  if (!mounted) return null;

  // Keep the menu fully inside the viewport (with an 8px margin) so it never
  // overflows off-screen or overlaps the header. ~224px wide (w-56), ~390px tall.
  const MARGIN = 8;
  const MENU_W = 224;
  const MENU_H = 390;
  const vw = typeof window !== 'undefined' ? window.innerWidth : MENU_W + 2 * MARGIN;
  const vh = typeof window !== 'undefined' ? window.innerHeight : MENU_H + 2 * MARGIN;
  const adjustedX = Math.max(MARGIN, Math.min(position.x, vw - MENU_W - MARGIN));
  const adjustedY = Math.max(MARGIN, Math.min(position.y, vh - MENU_H - MARGIN));

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/song/${track.id}` : '';

  // "Go to Artist / Album" — navigate by id when available, else search by name.
  const artist = track.artists?.find((a) => a.id) || track.artists?.[0];

  // Song data carries artist *names* but usually no browse-id, so resolve the
  // name to an artist id via search, then open the real artist page. The UI is
  // dismissed immediately; navigation follows once resolved.
  const goToArtist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate?.();
    onClose();
    if (artist?.id) {
      router.push(`/artist/${artist.id}`);
      return;
    }
    const name = artist?.name;
    if (!name) return;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(name)}`);
      const data = await res.json();
      const list: any[] = data.artists || [];
      const match = list.find((a) => a.id && a.name?.toLowerCase() === name.toLowerCase()) || list.find((a) => a.id);
      router.push(match?.id ? `/artist/${match.id}` : `/search?q=${encodeURIComponent(name)}`);
    } catch {
      router.push(`/search?q=${encodeURIComponent(name)}`);
    }
  };

  const goToAlbum = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate?.();
    onClose();
    if (track.album?.id) {
      router.push(`/album/${track.album.id}`);
      return;
    }
    const name = track.album?.name;
    if (!name) {
      router.push(`/search?q=${encodeURIComponent(track.title)}`);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(name)}`);
      const data = await res.json();
      const match: any = (data.albums || []).find((a: any) => a.id);
      router.push(match?.id ? `/album/${match.id}` : `/search?q=${encodeURIComponent(name)}`);
    } catch {
      router.push(`/search?q=${encodeURIComponent(name)}`);
    }
  };

  const handleRemoveFromPlaylist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playlistId) {
      try {
        await removeSongFromPlaylist(playlistId, track.id);
        if (onRemoveSuccess) {
          onRemoveSuccess();
        }
      } catch (err) {
        console.error('Failed to remove track from playlist:', err);
      }
    }
    onClose();
  };

  const menuItems = (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); addNext(track); onClose(); }}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <PlayCircle className="w-4 h-4 mr-3 text-zinc-400" />
        Play Next
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); addToQueue(track); onClose(); }}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <PlusCircle className="w-4 h-4 mr-3 text-zinc-400" />
        Add to Queue
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); setIsAddToPlaylistOpen(true); }}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <FolderPlus className="w-4 h-4 mr-3 text-zinc-400" />
        Add to Playlist
      </button>

      {playlistId && (
        <button
          onClick={handleRemoveFromPlaylist}
          className="w-full flex items-center px-4 py-2 text-sm text-red-550 hover:bg-zinc-800 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4 mr-3" />
          Remove from Playlist
        </button>
      )}

      <div className="h-px bg-zinc-800 my-1" />

      {isDownloaded(track.id) ? (
        <button
          onClick={(e) => { e.stopPropagation(); deleteDownload(track.id); onClose(); }}
          className="w-full flex items-center px-4 py-2 text-sm text-green-500 hover:bg-zinc-800 hover:text-green-400 transition-colors"
        >
          <Download className="w-4 h-4 mr-3 fill-current" />
          Remove Download
        </button>
      ) : isDownloading(track.id) ? (
        <button
          onClick={(e) => { e.stopPropagation(); cancelDownload(track.id); onClose(); }}
          className="w-full flex items-center px-4 py-2 text-sm text-red-550 hover:bg-zinc-800 hover:text-red-400 transition-colors"
        >
          <span className="w-4 h-4 mr-3 flex items-center justify-center text-[9px] font-bold">
            {activeDownloads[track.id] || 0}%
          </span>
          Cancel Download
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); startDownload(track); onClose(); }}
          className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4 mr-3 text-zinc-400" />
          Download
        </button>
      )}

      <div className="h-px bg-zinc-800 my-1" />

      <SharePopover
        options={{ title: track.title, text: `Listen to ${track.title} by ${track.artists.map(a => a.name).join(', ')}`, url: shareUrl }}
        align="left"
        side="bottom"
      >
        <div className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors w-56">
          <Share className="w-4 h-4 mr-3 text-zinc-400" />
          Share
        </div>
      </SharePopover>

      <div className="h-px bg-zinc-800 my-1" />

      <button
        onClick={goToArtist}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <User className="w-4 h-4 mr-3 text-zinc-400" />
        Go to Artist
      </button>

      <button
        onClick={goToAlbum}
        className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <Disc className="w-4 h-4 mr-3 text-zinc-400" />
        Go to Album
      </button>
    </>
  );

  // Bottom sheet (mobile / full player) — slides up from the bottom like Spotify.
  if (variant === 'sheet') {
    return createPortal(
      <AnimatePresence onExitComplete={onClose}>
        {sheetOpen && (
          <div key="sheet" className="fixed inset-0 z-[100]" onContextMenu={(e) => e.preventDefault()}>
            <motion.div
              className="absolute inset-0 bg-black/60"
              onClick={dismiss}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              ref={menuRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl border-t border-white/10 shadow-2xl max-h-[85vh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),16px)] [&_button]:py-3.5"
            >
              <div className="mx-auto h-1.5 w-10 rounded-full bg-zinc-600 my-3" />
              <div className="flex items-center gap-3 px-4 pb-4 mb-1 border-b border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={track.thumbnail || '/placeholder-album.png'}
                  alt=""
                  className="w-12 h-12 rounded object-cover bg-zinc-800 shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{track.title}</div>
                  <div className="text-sm text-zinc-400 truncate">{track.artists.map((a) => a.name).join(', ')}</div>
                </div>
              </div>
              {menuItems}
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    );
  }

  // Positioned dropdown (default)
  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] w-56 max-h-[85vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-4 py-2 border-b border-zinc-800 mb-1 overflow-hidden">
        <div className="font-medium text-sm text-white truncate">{track.title}</div>
        <div className="text-xs text-zinc-500 truncate">{track.artists.map((a) => a.name).join(', ')}</div>
      </div>
      {menuItems}
    </div>,
    document.body
  );
}
