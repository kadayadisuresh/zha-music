"use client";

import { create } from 'zustand';
import { initDB } from '@/lib/db/idb';
import { Track } from '@/lib/api/mappers';

interface DownloadState {
  activeDownloads: Record<string, number>; // videoId -> progress (0-100)
  downloadedIds: string[];
  downloadedTracks: Track[];
  isInitialized: boolean;
  
  initialize: () => void;
  loadDownloads: () => Promise<void>;
  startDownload: (track: Track) => Promise<void>;
  cancelDownload: (videoId: string) => void;
  deleteDownload: (videoId: string) => Promise<void>;
  isDownloaded: (videoId: string) => boolean;
  isDownloading: (videoId: string) => boolean;
}

let worker: Worker | null = null;

export const useDownloadStore = create<DownloadState>((set, get) => ({
  activeDownloads: {},
  downloadedIds: [],
  downloadedTracks: [],
  isInitialized: false,

  initialize: () => {
    if (get().isInitialized || typeof window === 'undefined') return;

    // Load initial downloaded IDs
    get().loadDownloads();

    // Create Web Worker
    worker = new Worker('/download-worker.js');
    
    worker.onmessage = (e) => {
      const { type, videoId, progress, error } = e.data;
      
      if (type === 'PROGRESS') {
        set((state) => ({
          activeDownloads: {
            ...state.activeDownloads,
            [videoId]: progress,
          },
        }));
      } else if (type === 'COMPLETE') {
        set((state) => {
          const active = { ...state.activeDownloads };
          delete active[videoId];
          return { activeDownloads: active };
        });
        get().loadDownloads();
      } else if (type === 'CANCELLED' || type === 'ERROR') {
        set((state) => {
          const active = { ...state.activeDownloads };
          delete active[videoId];
          return { activeDownloads: active };
        });
        if (type === 'ERROR') {
          console.error(`Download error for track ${videoId}:`, error);
        }
      }
    };

    set({ isInitialized: true });
  },

  loadDownloads: async () => {
    try {
      const db = await initDB();
      const allMeta = await db.getAll('zha-downloads-meta');
      
      const downloadedIds = allMeta.map((m: any) => m.videoId);
      
      const downloadedTracks: Track[] = allMeta.map((m: any) => {
        if (m.track) return m.track;
        return {
          id: m.videoId,
          title: m.title,
          artists: [{ name: m.artist }],
          thumbnail: m.thumbnail,
          duration: m.duration || 0,
        };
      });

      set({ downloadedIds, downloadedTracks });
    } catch (err) {
      console.error('Failed to load downloads:', err);
    }
  },

  startDownload: async (track: Track) => {
    if (!worker) {
      get().initialize();
    }

    const { downloadedIds, activeDownloads } = get();
    if (downloadedIds.includes(track.id) || activeDownloads[track.id] !== undefined) {
      return;
    }

    set((state) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [track.id]: 0,
      },
    }));

    // Resolve the direct googlevideo CDN URL; the worker fetches the bytes from
    // YouTube directly (no server proxy). NOTE: cross-origin fetch of the CDN may
    // be blocked by CORS in some browsers — playback (the <audio> element) is not
    // affected, but downloads can fail.
    let downloadUrl: string;
    try {
      const res = await fetch(`/api/innertube/stream?videoId=${track.id}`);
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(`resolve failed: ${res.status}`);
      downloadUrl = data.url;
    } catch (err) {
      console.error('Failed to resolve download URL:', err);
      set((state) => {
        const next = { ...state.activeDownloads };
        delete next[track.id];
        return { activeDownloads: next };
      });
      return;
    }
    const contentLength = 0; // The worker reads it from the Content-Length header.

    if (worker) {
      worker.postMessage({
        type: 'ADD_TO_QUEUE',
        payload: {
          videoId: track.id,
          url: downloadUrl,
          contentLength,
          meta: {
            videoId: track.id,
            title: track.title,
            artist: track.artists.map((a) => a.name).join(', '),
            thumbnail: track.thumbnail || '',
            duration: track.duration,
            track,
          },
        },
      });
    }
  },

  cancelDownload: (videoId: string) => {
    if (worker) {
      worker.postMessage({
        type: 'CANCEL',
        payload: videoId,
      });
    }
  },

  deleteDownload: async (videoId: string) => {
    try {
      const db = await initDB();
      await db.delete('zha-downloads-meta', videoId);
      await db.delete('zha-downloads-audio', videoId);
      await get().loadDownloads();
    } catch (err) {
      console.error('Failed to delete download:', err);
    }
  },

  isDownloaded: (videoId: string) => {
    return get().downloadedIds.includes(videoId);
  },

  isDownloading: (videoId: string) => {
    return get().activeDownloads[videoId] !== undefined;
  },
}));
