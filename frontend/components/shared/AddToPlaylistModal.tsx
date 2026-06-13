'use client';

import React, { useEffect, useState } from 'react';
import { usePlaylistStore } from '@/lib/stores/playlistStore';
import { Music2, Plus, X, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
}

export default function AddToPlaylistModal({ isOpen, onClose, songId }: AddToPlaylistModalProps) {
  const { playlists, fetchPlaylists, addSongToPlaylist, createPlaylist } = usePlaylistStore();
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [successId, setSuccessId] = useState<number | string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlaylists();
      setIsCreatingInline(false);
      setNewTitle('');
      setSuccessId(null);
    }
  }, [isOpen, fetchPlaylists]);

  if (!isOpen) return null;

  const handleAddToPlaylist = async (playlistId: number | string) => {
    try {
      await addSongToPlaylist(playlistId, songId);
      setSuccessId(playlistId);
      // Brief visual feedback before closing
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err) {
      console.error('Failed to add song to playlist:', err);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const playlist = await createPlaylist(newTitle, '');
      await handleAddToPlaylist(playlist.id);
    } catch (err) {
      console.error('Failed to create and add:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-850 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
        >
          <X size={16} />
        </button>

        <h3 className="text-lg font-bold text-white mb-4 pr-6">Add to Playlist</h3>

        {!isCreatingInline ? (
          <>
            <div className="max-h-60 overflow-y-auto space-y-1 mb-4 pr-1 scrollbar-thin">
              {playlists.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">No playlists created yet.</p>
              ) : (
                playlists.map((playlist) => {
                  const isSuccess = successId === playlist.id;
                  return (
                    <button
                      key={playlist.id}
                      onClick={() => handleAddToPlaylist(playlist.id)}
                      disabled={successId !== null}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800/60 transition-all text-left group",
                        isSuccess && "bg-green-950/30 border border-green-500/20"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-zinc-750 transition-colors">
                          <Music2 size={16} className={cn("text-zinc-400 group-hover:text-red-600 transition-colors", isSuccess && "text-green-500")} />
                        </div>
                        <span className={cn("text-sm font-semibold text-zinc-200 group-hover:text-white truncate", isSuccess && "text-green-400")}>
                          {playlist.title}
                        </span>
                      </div>
                      <div>
                        {isSuccess ? (
                          <span className="text-xs font-bold text-green-500">Added!</span>
                        ) : (
                          <Plus size={16} className="text-zinc-500 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setIsCreatingInline(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-800 hover:border-zinc-750 bg-zinc-950/40 hover:bg-zinc-900 text-sm font-semibold text-zinc-300 hover:text-white transition-all"
            >
              <FolderPlus size={16} className="text-red-600" />
              <span>Create New Playlist</span>
            </button>
          </>
        ) : (
          <form onSubmit={handleCreateAndAdd} className="space-y-4 animate-in slide-in-from-bottom-2 duration-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Playlist Name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Chill Beats"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition-colors text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsCreatingInline(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-full text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Create & Add
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
