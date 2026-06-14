'use client';

import React, { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Music2, Play, Trash2, ArrowLeft, Search, Plus, X, Users, Check, MessageSquare } from 'lucide-react';
import { usePlaylistCollab } from '@/components/playlist/PlaylistCollabContext';
import { PlaylistChat } from '@/components/playlist/PlaylistChat';
import Image from 'next/image';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { usePlaylistStore, PlaylistDetails } from '@/lib/stores/playlistStore';
import { useUserStore } from '@/lib/stores/userStore';
import * as sb from '@/lib/supabase/data';
import { TrackItem } from '@/components/shared/TrackItem';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { Track } from '@/lib/api/mappers';

interface PlaylistPageProps {
  params: Promise<{ id: string }>;
}

const COVER_KEY = (id: string) => `zha-playlist-cover-${id}`;

export default function PlaylistPage({ params }: PlaylistPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { fetchPlaylistDetails, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist } = usePlaylistStore();
  const { playTrack, setQueue } = usePlaybackStore();

  const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Cover image — read-only display of the server-stored cover (changing the
  // cover is no longer a feature).
  const [coverImage, setCoverImage] = useState<string | null>(null);

  // Search panel
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Delete playlist confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  // Collaboration
  const user = useUserStore((s) => s.user);
  const collab = usePlaylistCollab();
  const [inviteCopied, setInviteCopied] = useState(false);
  const [changeBanner, setChangeBanner] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const isOwner = !!(user && playlist?.owner_id && String(playlist.owner_id) === String(user.id));
  const isCollaborative = !!playlist?.is_collaborative;

  // Load cover from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COVER_KEY(id));
      if (saved) setCoverImage(saved);
    }
  }, [id]);

  const loadPlaylistData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const details = await fetchPlaylistDetails(id);
      setPlaylist(details);
      // Prefer the server-stored cover; fall back to any local one already set.
      if (details.cover_url) setCoverImage(details.cover_url);

      const trackPromises = details.songs.map(async (song) => {
        try {
          const res = await fetch(`/api/innertube/track?video_id=${song.song_id}`);
          if (!res.ok) throw new Error('Failed to fetch track');
          return await res.json();
        } catch (e) {
          console.error('Failed to load metadata for song:', song.song_id, e);
          return { id: song.song_id, title: 'Unknown Track', artists: [{ name: 'Unknown Artist' }], duration: 0 };
        }
      });

      setTracks(await Promise.all(trackPromises));
    } catch (err) {
      console.error('Error loading playlist details:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => { loadPlaylistData(); }, [id]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults((await res.json()).songs || []);
      } catch (err) { console.error('Search failed:', err); }
      finally { setIsSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePlayAll = () => {
    if (tracks.length > 0) { setQueue(tracks); playTrack(tracks[0]); }
  };

  const handleDeletePlaylist = async () => {
    try {
      const parsedId = id.startsWith('local-') ? id : parseInt(id, 10);
      await deletePlaylist(parsedId);
      localStorage.removeItem(COVER_KEY(id)); // clean up cover too
      router.push('/');
    } catch (err) { console.error('Failed to delete playlist:', err); }
  };

  const handleRemoveTrack = async (songId: string) => {
    // On a collaborative playlist, route through Supabase Realtime so the change
    // persists once (under RLS) and broadcasts to everyone. The broadcast
    // bumps `revision`, which reloads the list.
    if (isCollaborative && collab) {
      collab.removeTrack(songId);
      return;
    }
    setRemovingId(songId);
    try {
      const parsedId = id.startsWith('local-') ? id : parseInt(id, 10);
      await removeSongFromPlaylist(parsedId, songId);
      await loadPlaylistData();
    } catch (err) { console.error('Failed to remove track:', err); }
    finally { setRemovingId(null); }
  };

  // Reload + show a subtle indicator when a remote collaborator changes tracks
  useEffect(() => {
    if (!collab || collab.revision === 0) return;
    loadPlaylistData(true); // background refresh — don't blank the page to a spinner
    const lc = collab.lastChange;
    if (lc && lc.actor !== (user?.display_name || '')) {
      const verb = lc.kind === 'track_added' ? 'added' : lc.kind === 'track_removed' ? 'removed' : 'reordered';
      setChangeBanner(`${lc.actor} ${verb} a track`);
      const t = setTimeout(() => setChangeBanner(null), 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collab?.revision]);

  // Generate a fresh invite link and copy it to the clipboard.
  const copyInviteLink = async (): Promise<boolean> => {
    if (!playlist) return false;
    try {
      const token = await sb.createInviteToken(Number(playlist.id));
      const link = `${window.location.origin}/playlist/join/${token}`;
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
      return true;
    } catch (err) {
      console.error('Failed to create invite:', err);
      return false;
    }
  };

  // Collaborate = ensure the playlist is collaborative and copy a fresh invite
  // link. The button flashes a green "Link copied!" then reverts on its own.
  const handleCollaborate = async () => {
    if (!playlist) return;
    if (!isCollaborative) setPlaylist({ ...playlist, is_collaborative: true });
    // createInviteToken() also flips the playlist to collaborative under RLS.
    await copyInviteLink();
  };



  const handleOpenSearch = () => {
    setShowSearch(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ── Loading / Not Found states ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen pb-32">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-red-600 border-r-2" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-8 max-w-screen-2xl mx-auto pb-32 text-center">
        <p className="text-zinc-400 mb-4">Playlist not found</p>
        <Button onClick={() => router.push('/')} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-full">
          Go Home
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-screen-2xl mx-auto pb-32">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6 group text-sm font-semibold"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Back
      </button>

      {/* ── Playlist Header ── */}
      <div className="flex flex-col md:flex-row md:flex-wrap items-center md:items-end gap-6 mb-8 text-center md:text-left">

        {/* Cover art (read-only) */}
        <div className="w-40 h-40 bg-gradient-to-br from-zinc-800 to-zinc-950 border border-white/5 rounded-2xl shadow-2xl flex items-center justify-center relative overflow-hidden flex-shrink-0 select-none">
          {coverImage ? (
            <Image
              src={coverImage}
              alt="Playlist cover"
              fill
              className="object-cover rounded-2xl"
              unoptimized
            />
          ) : (
            <Music2 className="w-16 h-16 text-white" />
          )}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0 md:basis-80">
          <p className="text-sm font-bold uppercase tracking-widest text-red-600 mb-2">Playlist</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-white truncate">{playlist.title}</h1>
          {playlist.description && <p className="text-zinc-400 text-sm mb-3 line-clamp-2">{playlist.description}</p>}
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
          </p>

          {/* Presence avatars — who is viewing right now */}
          {isCollaborative && collab && collab.online.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex -space-x-2">
                {collab.online.slice(0, 5).map((u) =>
                  u.avatarUrl ? (
                    <Image
                      key={u.userId}
                      src={u.avatarUrl}
                      alt={u.displayName}
                      width={28}
                      height={28}
                      title={u.displayName}
                      className="rounded-full h-7 w-7 ring-2 ring-black"
                      unoptimized
                    />
                  ) : (
                    <div key={u.userId} title={u.displayName} className="h-7 w-7 rounded-full bg-zinc-600 ring-2 ring-black flex items-center justify-center text-[10px] text-white">
                      {u.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )
                )}
              </div>
              <span className="text-xs text-zinc-400">
                {collab.online.length} viewing
                <span className={`inline-block w-1.5 h-1.5 rounded-full ml-2 ${collab.connected ? 'bg-green-500' : 'bg-zinc-600'}`} />
              </span>
            </div>
          )}

          {/* Subtle change indicator */}
          {changeBanner && (
            <p className="mt-2 text-xs text-[#2E7DF7] animate-in fade-in slide-in-from-left-2 duration-300">
              ● {changeBanner}
            </p>
          )}

        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end md:flex-shrink-0 md:ml-auto">
          {tracks.length > 0 && (
            <Button
              onClick={handlePlayAll}
              className="bg-[#2E7DF7] hover:bg-[#1F5FD0] text-white font-bold px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
            >
              <Play size={18} fill="currentColor" />
              <span>Play All</span>
            </Button>
          )}

          <button
            onClick={handleOpenSearch}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-900 border border-zinc-700 hover:border-white/30 hover:bg-zinc-800 text-white rounded-full transition-all text-sm font-semibold shadow-lg hover:scale-105 active:scale-95"
          >
            <Plus size={16} />
            Add Music
          </button>

          {/* Collaborate — owner only. Copies a fresh invite link, flashes a
              green "Link copied!", then reverts back to "Collaborate". */}
          {isOwner && (
            <button
              onClick={handleCollaborate}
              className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all text-sm font-semibold shadow-lg hover:scale-105 active:scale-95 border ${
                inviteCopied
                  ? 'bg-green-500/15 border-green-500/40 text-green-400'
                  : 'bg-[#2E7DF7]/15 border-[#2E7DF7]/40 text-[#2E7DF7] hover:bg-[#2E7DF7]/25 hover:border-[#2E7DF7]/60'
              }`}
            >
              {inviteCopied ? <Check size={16} className="text-green-400" /> : <Users size={16} />}
              {inviteCopied ? 'Link copied!' : 'Collaborate'}
            </button>
          )}

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-900 border border-zinc-700 hover:border-red-500/40 hover:bg-red-950/30 text-zinc-400 hover:text-red-400 rounded-full transition-all text-sm font-semibold shadow-lg hover:scale-105 active:scale-95"
          >
            <Trash2 size={16} />
            Delete Playlist
          </button>

        </div>
      </div>

      {/* ── Track List ── */}
      {tracks.length === 0 ? (
        <EmptyState
          icon={<Music2 className="w-12 h-12 text-zinc-600" />}
          title="This playlist is empty"
          description="Click 'Add Music' to find songs and build your playlist."
        />
      ) : (
        <div className="space-y-1">
          <div className="flex items-center px-3 pb-2 mb-1 border-b border-zinc-800 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
            <span className="w-8 text-right mr-5">#</span>
            <span className="flex-1">Title</span>
            <span className="mr-4">Duration</span>
            <span className="w-8" />
          </div>

          {tracks.map((track, index) => (
            <div key={`${track.id}-${index}`} className="flex items-center group">
              <div className="flex-1 min-w-0">
                <TrackItem
                  track={track}
                  index={index + 1}
                  playlistId={playlist.id}
                  onRemoveSuccess={loadPlaylistData}
                  onClick={() => { setQueue(tracks); playTrack(track); }}
                />
              </div>
              <button
                onClick={() => handleRemoveTrack(track.id)}
                disabled={removingId === track.id}
                title="Remove from playlist"
                className="ml-2 flex-shrink-0 p-2 rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 active:scale-90 disabled:opacity-40"
              >
                {removingId === track.id ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-t-2 border-red-500 border-r-2" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Playlist Confirmation ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 bg-zinc-950 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-14 h-14 bg-red-950/40 border border-red-500/20 rounded-full mx-auto mb-5">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Delete Playlist?</h3>
            <p className="text-zinc-400 text-sm text-center mb-8">
              &quot;<span className="text-white font-semibold">{playlist.title}</span>&quot; will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlaylist}
                className="flex-1 py-3 rounded-full bg-[#dc2626] hover:bg-[#b91c1c] text-white transition-colors text-sm font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Music Search Drawer ── */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleCloseSearch} />
          <div className="relative z-10 w-full max-w-2xl mx-4 mb-8 sm:mb-0 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-900 rounded-full border border-white/5">
                  <Plus size={14} className="text-red-500" />
                </div>
                <h2 className="text-base font-bold text-white">Add Music to Playlist</h2>
              </div>
              <button onClick={handleCloseSearch} className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pt-5 pb-4">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for songs, artists or albums..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-zinc-400 text-white placeholder-zinc-500 rounded-full px-5 py-3 pr-12 focus:outline-none transition-colors text-sm"
                />
                {isSearching ? (
                  <div className="absolute right-4 top-3.5 animate-spin rounded-full h-4 w-4 border-t-2 border-red-500 border-r-2" />
                ) : (
                  <Search className="absolute right-4 top-3.5 w-4 h-4 text-zinc-500" />
                )}
              </div>
            </div>

            <div className="px-6 pb-6 max-h-[50vh] overflow-y-auto space-y-1">
              {searchResults.length > 0 ? (
                searchResults.map((song) => {
                  const isAlreadyAdded = tracks.some(t => t.id === song.id);
                  return (
                    <div key={song.id} className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-xl transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <div className="relative w-10 h-10 flex-shrink-0 rounded-md overflow-hidden">
                          {song.thumbnail ? (
                            <Image src={song.thumbnail} alt={song.title} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                              <Music2 size={16} className="text-zinc-600" />
                            </div>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-semibold text-sm text-white truncate">{song.title}</div>
                          <div className="text-xs text-zinc-400 truncate">{song.artists.map(a => a.name).join(', ')}</div>
                        </div>
                      </div>
                      <button
                        disabled={isAlreadyAdded}
                        onClick={async () => {
                          if (isAlreadyAdded) return;
                          // Collaborative: persist + broadcast via Realtime (syncs everyone)
                          if (isCollaborative && collab) {
                            collab.addTrack(song.id);
                            return;
                          }
                          try {
                            const parsedId = id.startsWith('local-') ? id : parseInt(id, 10);
                            await addSongToPlaylist(parsedId, song.id);
                            await loadPlaylistData();
                          } catch (err) { console.error('Failed to add song:', err); }
                        }}
                        className={`ml-3 flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                          isAlreadyAdded
                            ? 'bg-zinc-800 text-zinc-500 cursor-default'
                            : 'bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95'
                        }`}
                      >
                        {isAlreadyAdded ? '✓ Added' : '+ Add'}
                      </button>
                    </div>
                  );
                })
              ) : searchQuery && !isSearching ? (
                <p className="text-zinc-500 text-sm text-center py-6">No songs found for &quot;{searchQuery}&quot;</p>
              ) : (
                <p className="text-zinc-600 text-xs text-center py-6">Start typing to search for songs</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Collaborative Chat (slide-in panel + toggle) ── */}
      {isCollaborative && (
        <>
          <button
            onClick={() => setShowChat((v) => !v)}
            aria-label={showChat ? 'Close chat' : 'Open chat'}
            className="fixed bottom-28 right-5 z-40 p-3.5 rounded-full bg-[#2E7DF7] hover:bg-[#1F5FD0] text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            {showChat ? <X size={20} /> : <MessageSquare size={20} />}
          </button>

          <div
            className={`fixed top-0 right-0 z-40 h-full w-full sm:w-[360px] transform transition-transform duration-300 ${
              showChat ? 'translate-x-0' : 'translate-x-full pointer-events-none'
            }`}
          >
            <PlaylistChat />
          </div>
        </>
      )}

    </div>
  );
}
