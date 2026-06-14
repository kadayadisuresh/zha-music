import { create } from 'zustand';
import { useUserStore } from './userStore';
import * as sb from '../supabase/data';

export interface Playlist {
  id: number | string; // server playlists use numeric ids; local ones use strings
  title: string;
  description?: string;
}

export interface PlaylistSongItem {
  song_id: string;
  position: number;
}

export interface PlaylistDetails extends Playlist {
  is_collaborative: boolean;
  invite_token?: string;
  owner_id?: string;
  cover_url?: string | null;
  songs: PlaylistSongItem[];
}

interface PlaylistState {
  playlists: Playlist[];
  isLoading: boolean;
  error: string | null;
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (title: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (playlistId: number | string) => Promise<void>;
  addSongToPlaylist: (playlistId: number | string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (playlistId: number | string, songId: string) => Promise<void>;
  fetchPlaylistDetails: (playlistId: number | string) => Promise<PlaylistDetails>;
}

// Numeric id ⇒ a server (Supabase) playlist; anything else ⇒ a local (localStorage) one.
const isServerId = (id: number | string) => /^\d+$/.test(String(id));

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  isLoading: false,
  error: null,

  fetchPlaylists: async () => {
    set({ isLoading: true, error: null });
    const user = useUserStore.getState().user;
    if (user) {
      try {
        const rows = await sb.listPlaylists(); // RLS returns only the user's playlists
        set({
          playlists: rows.map((p) => ({ id: p.id, title: p.title, description: p.description ?? undefined })),
          isLoading: false,
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Failed to fetch playlists', isLoading: false });
      }
    } else if (typeof window !== 'undefined') {
      const local = localStorage.getItem('zha-local-playlists');
      set({ playlists: local ? JSON.parse(local) : [], isLoading: false });
    } else {
      set({ playlists: [], isLoading: false });
    }
  },

  createPlaylist: async (title, description = '') => {
    const user = useUserStore.getState().user;
    if (user) {
      const p = await sb.createPlaylist(title, description);
      await get().fetchPlaylists();
      return { id: p.id, title: p.title, description: p.description ?? undefined };
    }
    // Local storage (anonymous)
    const newPlaylist: Playlist = { id: `local-${Date.now()}`, title, description };
    const localPlaylists = typeof window !== 'undefined' ? localStorage.getItem('zha-local-playlists') : null;
    const list = localPlaylists ? JSON.parse(localPlaylists) : [];
    list.push(newPlaylist);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zha-local-playlists', JSON.stringify(list));
      localStorage.setItem(`zha-local-playlist-${newPlaylist.id}`, JSON.stringify([]));
    }
    set({ playlists: list });
    return newPlaylist;
  },

  deletePlaylist: async (playlistId) => {
    if (isServerId(playlistId)) {
      await sb.deletePlaylist(Number(playlistId));
      await get().fetchPlaylists();
    } else {
      const localPlaylists = typeof window !== 'undefined' ? localStorage.getItem('zha-local-playlists') : null;
      let list = localPlaylists ? JSON.parse(localPlaylists) : [];
      list = list.filter((p: Playlist) => p.id !== playlistId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('zha-local-playlists', JSON.stringify(list));
        localStorage.removeItem(`zha-local-playlist-${playlistId}`);
      }
      set({ playlists: list });
    }
  },

  addSongToPlaylist: async (playlistId, songId) => {
    if (isServerId(playlistId)) {
      await sb.addSongToPlaylist(Number(playlistId), songId);
    } else {
      const key = `zha-local-playlist-${playlistId}`;
      const localSongs = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      const songs: PlaylistSongItem[] = localSongs ? JSON.parse(localSongs) : [];
      if (!songs.some((s) => s.song_id === songId)) {
        songs.push({ song_id: songId, position: songs.length });
        if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(songs));
      }
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    if (isServerId(playlistId)) {
      await sb.removeSongFromPlaylist(Number(playlistId), songId);
    } else {
      const key = `zha-local-playlist-${playlistId}`;
      const localSongs = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      let songs: PlaylistSongItem[] = localSongs ? JSON.parse(localSongs) : [];
      songs = songs.filter((s) => s.song_id !== songId);
      if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(songs));
    }
  },

  fetchPlaylistDetails: async (playlistId): Promise<PlaylistDetails> => {
    if (isServerId(playlistId)) {
      const d = await sb.getPlaylistDetails(Number(playlistId));
      return {
        id: d.id,
        title: d.title,
        description: d.description ?? undefined,
        is_collaborative: d.is_collaborative,
        owner_id: d.owner_id,
        cover_url: d.cover_url,
        songs: d.songs,
      };
    }
    // Local storage (anonymous)
    const localPlaylists = typeof window !== 'undefined' ? localStorage.getItem('zha-local-playlists') : null;
    const list = localPlaylists ? JSON.parse(localPlaylists) : [];
    const playlist = list.find((p: Playlist) => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');
    const key = `zha-local-playlist-${playlistId}`;
    const localSongs = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    const songs: PlaylistSongItem[] = localSongs ? JSON.parse(localSongs) : [];
    return { ...playlist, is_collaborative: false, songs };
  },
}));
