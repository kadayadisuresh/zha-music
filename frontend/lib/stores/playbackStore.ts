import { create } from 'zustand';

export interface Track {
  id: string;
  title: string;
  artists: { id?: string; name: string }[];
  thumbnail?: string;
  duration?: number;
  album?: { id?: string; name?: string };
}

interface PlaybackState {
  currentTrack: Track | null;
  nextTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  networkType: string;
  
  // Actions
  setTrack: (track: Track | null) => void;
  setNextTrack: (track: Track | null) => void;
  setQueue: (queue: Track[]) => void;
  setQueueIndex: (index: number) => void;
  playTrack: (track: Track) => void;
  setPlaying: (isPlaying: boolean) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (currentTime: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setNetworkType: (type: string) => void;
  
  // Helpers
  next: () => void;
  previous: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentTrack: null,
  nextTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  volume: 1,
  isMuted: false,
  isLoading: false,
  networkType: '4g',

  setTrack: (track) => set({ currentTrack: track }),
  setNextTrack: (track) => set({ nextTrack: track }),
  setQueue: (queue) => set({ queue }),
  setQueueIndex: (queueIndex) => set({ queueIndex }),
  
  playTrack: (track) => {
    set({ currentTrack: track, isPlaying: true });
    // Note: The actual audio playing is handled by AudioEngine which listens to store changes 
    // or is called directly. In our case, AudioEngine is a singleton that we'll call.
    // We import it dynamically to avoid circular dependencies if any.
    import('../audio/AudioEngine').then(({ audioEngine }) => {
      audioEngine.play(track.id, track);
    });
  },

  setPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (duration) => set({ duration }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setNetworkType: (networkType) => set({ networkType }),

  next: () => {
    const { queue, queueIndex } = get();
    if (queueIndex < queue.length - 1) {
      const nextIdx = queueIndex + 1;
      const nextTrack = queue[nextIdx];
      set({ queueIndex: nextIdx });
      get().playTrack(nextTrack);
    }
  },

  previous: () => {
    const { queue, queueIndex, currentTime } = get();
    if (currentTime > 3) {
      // If more than 3 seconds in, just restart the song
      import('../audio/AudioEngine').then(({ audioEngine }) => {
        audioEngine.seek(0);
      });
      return;
    }

    if (queueIndex > 0) {
      const prevIdx = queueIndex - 1;
      const prevTrack = queue[prevIdx];
      set({ queueIndex: prevIdx });
      get().playTrack(prevTrack);
    }
  }
}));
