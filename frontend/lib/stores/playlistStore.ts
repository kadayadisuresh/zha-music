import { create } from 'zustand';
import { apiClient } from '../api/client';
import { useUserStore } from './userStore';
import { Track } from '../api/mappers';

export interface Playlist {
  id: number | string; // backend uses numbers, local uses strings/timestamps
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

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  isLoading: false,
  error: null,

  fetchPlaylists: async () => {
    set({ isLoading: true, error: null });
    const user = useUserStore.getState().user;

    if (user) {
      try {
        const playlists = await apiClient<Playlist[]>('/playlist/');
        set({ playlists, isLoading: false });
      } catch (err: any) {
        set({ error: err.message || 'Failed to fetch playlists', isLoading: false });
      }
    } else {
      // Load local playlists from localStorage
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('zha-local-playlists');
        const list = local ? JSON.parse(local) : [];
        set({ playlists: list, isLoading: false });
      } else {
        set({ playlists: [], isLoading: false });
      }
    }
  },

  createPlaylist: async (title: string, description: string = '') => {
    const user = useUserStore.getState().user;
    if (user) {
      const url = `/playlist/?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
      const playlist = await apiClient<Playlist>(url, { method: 'POST' });
      await get().fetchPlaylists();
      return playlist;
    } else {
      // Local storage
      const newPlaylist: Playlist = {
        id: `local-${Date.now()}`,
        title,
        description,
      };
      
      const localPlaylists = typeof window !== 'undefined' ? localStorage.getItem('zha-local-playlists') : null;
      const list = localPlaylists ? JSON.parse(localPlaylists) : [];
      list.push(newPlaylist);
      if (typeof window !== 'undefined') {
        localStorage.setItem('zha-local-playlists', JSON.stringify(list));
        // Initialize an empty songs array for this playlist
        localStorage.setItem(`zha-local-playlist-${newPlaylist.id}`, JSON.stringify([]));
      }
      set({ playlists: list });
      return newPlaylist;
    }
  },

  deletePlaylist: async (playlistId: number | string) => {
    const user = useUserStore.getState().user;
    if (/^\d+$/.test(String(playlistId))) {
      await apiClient(`/playlist/${playlistId}`, { method: 'DELETE' });
      await get().fetchPlaylists();
    } else {
      // Local storage
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

  addSongToPlaylist: async (playlistId: number | string, songId: string) => {
    const user = useUserStore.getState().user;
    if (/^\d+$/.test(String(playlistId))) {
      const url = `/playlist/${playlistId}/songs?song_id=${encodeURIComponent(songId)}`;
      await apiClient(url, { method: 'POST' });
    } else {
      // Local storage
      const key = `zha-local-playlist-${playlistId}`;
      const localSongs = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      const songs: PlaylistSongItem[] = localSongs ? JSON.parse(localSongs) : [];
      
      // Prevent duplicates in playlist
      if (!songs.some(s => s.song_id === songId)) {
        songs.push({ song_id: songId, position: songs.length });
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(songs));
        }
      }
    }
  },

  removeSongFromPlaylist: async (playlistId: number | string, songId: string) => {
    const user = useUserStore.getState().user;
    if (/^\d+$/.test(String(playlistId))) {
      await apiClient(`/playlist/${playlistId}/songs/${songId}`, { method: 'DELETE' });
    } else {
      // Local storage
      const key = `zha-local-playlist-${playlistId}`;
      const localSongs = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      let songs: PlaylistSongItem[] = localSongs ? JSON.parse(localSongs) : [];
      songs = songs.filter(s => s.song_id !== songId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(songs));
      }
    }
  },

  fetchPlaylistDetails: async (playlistId: number | string): Promise<PlaylistDetails> => {
    const user = useUserStore.getState().user;
    if (/^\d+$/.test(String(playlistId))) {
      return await apiClient<PlaylistDetails>(`/playlist/${playlistId}`);
    } else {
      // Local storage
      const localPlaylists = typeof window !== 'undefined' ? localStorage.getItem('zha-local-playlists') : null;
      const list = localPlaylists ? JSON.parse(localPlaylists) : [];
      const playlist = list.find((p: Playlist) => p.id === playlistId);
      
      if (!playlist) {
        throw new Error('Playlist not found');
      }

      const key = `zha-local-playlist-${playlistId}`;
      const localSongs = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      const songs: PlaylistSongItem[] = localSongs ? JSON.parse(localSongs) : [];

      return {
        ...playlist,
        is_collaborative: false,
        songs,
      };
    }
  },
}));
