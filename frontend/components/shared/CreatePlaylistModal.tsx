'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { usePlaylistStore } from '@/lib/stores/playlistStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Simple "create a playlist" dialog (name + optional description). Reusable —
 *  used by the mobile Create sheet. Creates the playlist then opens it. */
export const CreatePlaylistModal: React.FC<Props> = ({ open, onClose }) => {
  const router = useRouter();
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const close = () => {
    setTitle('');
    setDescription('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const playlist = await createPlaylist(title.trim(), description.trim());
      close();
      router.push(`/playlist/${playlist.id}`);
    } catch (err) {
      console.error('Failed to create playlist:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200 relative">
        <button onClick={close} className="absolute top-4 right-4 text-zinc-500 hover:text-white" aria-label="Close">
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Create New Playlist</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Playlist Name</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. My Awesome Mix"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#2E7DF7] transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Description (Optional)</label>
            <textarea
              placeholder="e.g. Songs for a rainy day"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#2E7DF7] transition-colors h-24 resize-none text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={close} className="px-5 py-2.5 rounded-full text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#2E7DF7] hover:bg-[#1F5FD0] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
