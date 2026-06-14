'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Link2, Check, Copy, X, Loader2 } from 'lucide-react';
import * as sb from '@/lib/supabase/data';
import { usePlaylistStore } from '@/lib/stores/playlistStore';
import { useUserStore } from '@/lib/stores/userStore';

interface CollaborateModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'form' | 'done';

/**
 * Create-a-collaborative-playlist flow, launched from the sidebar.
 * Step 1: name the playlist. On submit we create it, flip it to collaborative,
 * and mint an invite token — Step 2 shows the ready-to-share link.
 */
export const CollaborateModal = ({ open, onClose }: CollaborateModalProps) => {
  const router = useRouter();
  const { user } = useUserStore();
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);

  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playlistId, setPlaylistId] = useState<number | string | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const reset = () => {
    setStep('form');
    setTitle('');
    setDescription('');
    setBusy(false);
    setError(null);
    setPlaylistId(null);
    setShareLink('');
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      // 1. Create the playlist (owned by the current user).
      const playlist = await createPlaylist(title.trim(), description.trim());
      // 2. Mint an invite token — this also flips the playlist to collaborative.
      const token = await sb.createInviteToken(Number(playlist.id));
      const link = `${window.location.origin}/playlist/join/${token}`;
      setPlaylistId(playlist.id);
      setShareLink(link);
      setStep('done');
    } catch (err: any) {
      console.error('Failed to create collaborative playlist:', err);
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — select the field so the user can copy manually.
    }
  };

  const openPlaylist = () => {
    if (playlistId != null) router.push(`/playlist/${playlistId}`);
    close();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200 relative">
        <button
          onClick={close}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-full bg-[#2E7DF7]/15 flex items-center justify-center">
            <Users size={18} className="text-[#2E7DF7]" />
          </div>
          <h2 className="text-xl font-bold text-white">Collaborative Playlist</h2>
        </div>

        {/* Not signed in */}
        {!user ? (
          <div className="mt-4">
            <p className="text-sm text-zinc-400 mb-4">
              Sign in to create a collaborative playlist and invite others to add songs.
            </p>
            <button
              onClick={() => useUserStore.getState().signInWithGoogle()}
              className="w-full bg-white text-black text-sm font-bold py-2.5 rounded-full hover:bg-zinc-200 transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : step === 'form' ? (
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <p className="text-sm text-zinc-400 -mt-1">
              Give it a name — we&apos;ll create it and generate a sharing link instantly.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Playlist Name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Road Trip Mix"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#2E7DF7] transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Description (Optional)
              </label>
              <textarea
                placeholder="e.g. Everyone adds their favourites"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#2E7DF7] transition-colors h-20 resize-none text-sm"
              />
            </div>

            {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={close}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !title.trim()}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#2E7DF7] hover:bg-[#1F5FD0] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {busy ? 'Creating…' : 'Create & Get Link'}
              </button>
            </div>
          </form>
        ) : (
          /* step === 'done' */
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
              <Check size={16} />
              <span>&ldquo;{title.trim()}&rdquo; is ready to share</span>
            </div>
            <p className="text-sm text-zinc-400">
              Anyone with this link can join and add songs to the playlist.
            </p>

            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5">
              <Link2 size={16} className="text-zinc-500 shrink-0" />
              <input
                readOnly
                value={shareLink}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 bg-transparent text-xs text-zinc-300 focus:outline-none truncate"
              />
              <button
                onClick={copyLink}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  copied ? 'bg-green-500/15 text-green-400' : 'bg-[#2E7DF7] hover:bg-[#1F5FD0] text-white'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={close}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Done
              </button>
              <button
                onClick={openPlaylist}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
              >
                Open Playlist
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
