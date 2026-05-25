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
  originalQueue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  networkType: string;
  repeatMode: 'off' | 'one' | 'all';
  shuffleEnabled: boolean;
  
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
  setRepeatMode: (mode: 'off' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  
  // Helpers
  next: () => void;
  previous: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentTrack: null,
  nextTrack: null,
  queue: [],
  originalQueue: [],
  queueIndex: -1,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  volume: 1,
  isMuted: false,
  isLoading: false,
  networkType: '4g',
  repeatMode: 'off',
  shuffleEnabled: false,

  setTrack: (track) => set({ currentTrack: track }),
  setNextTrack: (track) => set({ nextTrack: track }),
  setQueue: (queue) => set({ queue, originalQueue: [...queue] }),
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
  setRepeatMode: (repeatMode) => set({ repeatMode }),

  toggleShuffle: () => {
    const { shuffleEnabled, queue, originalQueue, currentTrack } = get();
    const newShuffleEnabled = !shuffleEnabled;
    
    if (newShuffleEnabled) {
      // Shuffle the queue but keep current track at the top or at its current relative position?
      // Usually, YTM shuffles the REMAINING queue or shuffles all and moves current to top.
      // Let's shuffle all and move current to top for simplicity and better "shuffle" feel.
      const shuffled = [...originalQueue];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      if (currentTrack) {
        const currentIndex = shuffled.findIndex(t => t.id === currentTrack.id);
        if (currentIndex !== -1) {
          const [track] = shuffled.splice(currentIndex, 1);
          shuffled.unshift(track);
        }
      }
      
      set({ 
        shuffleEnabled: newShuffleEnabled, 
        queue: shuffled,
        queueIndex: currentTrack ? 0 : -1
      });
    } else {
      // Unshuffle: restore original queue and find current track index
      const newIndex = currentTrack ? originalQueue.findIndex(t => t.id === currentTrack.id) : -1;
      set({ 
        shuffleEnabled: newShuffleEnabled, 
        queue: [...originalQueue],
        queueIndex: newIndex
      });
    }
  },

  next: () => {
    const { queue, queueIndex, repeatMode } = get();
    
    if (repeatMode === 'one') {
      const current = queue[queueIndex];
      if (current) {
        get().playTrack(current);
        return;
      }
    }

    if (queueIndex < queue.length - 1) {
      const nextIdx = queueIndex + 1;
      const nextTrack = queue[nextIdx];
      set({ queueIndex: nextIdx });
      get().playTrack(nextTrack);
    } else if (repeatMode === 'all' && queue.length > 0) {
      const nextTrack = queue[0];
      set({ queueIndex: 0 });
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
    } else {
      // If at the beginning of queue, restart the song
      import('../audio/AudioEngine').then(({ audioEngine }) => {
        audioEngine.seek(0);
      });
    }
  }
}));
