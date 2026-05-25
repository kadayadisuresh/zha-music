import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Track {
  id: string;
  queueId?: string; // Unique ID for queue items to handle duplicates and DnD
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
  toggleRepeatMode: () => void;
  toggleShuffle: () => void;
  reorderQueue: (oldIndex: number, newIndex: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  addNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  
  // Helpers
  next: () => void;
  previous: () => void;
}

const generateQueueId = () => Math.random().toString(36).substring(2, 11);

export const usePlaybackStore = create<PlaybackState>()(
  persist(
    (set, get) => ({
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
      setQueue: (queue) => {
        const queueWithIds = queue.map(t => ({ ...t, queueId: t.queueId || generateQueueId() }));
        set({ queue: queueWithIds, originalQueue: [...queueWithIds] });
      },
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

      toggleRepeatMode: () => {
        const { repeatMode } = get();
        const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
        const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
        set({ repeatMode: nextMode });
      },

      toggleShuffle: () => {
        const { shuffleEnabled } = get();
        if (!shuffleEnabled) {
          get().shuffleQueue();
        } else {
          get().unshuffleQueue();
        }
      },

      shuffleQueue: () => {
        const { queue, currentTrack } = get();
        const shuffled = [...queue];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        if (currentTrack) {
          const currentIndex = shuffled.findIndex(t => t.queueId === currentTrack.queueId);
          if (currentIndex !== -1) {
            const [track] = shuffled.splice(currentIndex, 1);
            shuffled.unshift(track);
          }
        }
        
        set({ 
          shuffleEnabled: true, 
          queue: shuffled,
          queueIndex: currentTrack ? 0 : -1
        });
      },

      unshuffleQueue: () => {
        const { originalQueue, currentTrack } = get();
        const newIndex = currentTrack ? originalQueue.findIndex(t => t.queueId === currentTrack.queueId) : -1;
        set({ 
          shuffleEnabled: false, 
          queue: [...originalQueue],
          queueIndex: newIndex
        });
      },

      reorderQueue: (oldIndex, newIndex) => {
        const { queue, queueIndex } = get();
        const newQueue = [...queue];
        const [movedItem] = newQueue.splice(oldIndex, 1);
        newQueue.splice(newIndex, 0, movedItem);
        
        let newQueueIndex = queueIndex;
        if (queueIndex === oldIndex) {
          newQueueIndex = newIndex;
        } else if (oldIndex < queueIndex && newIndex >= queueIndex) {
          newQueueIndex--;
        } else if (oldIndex > queueIndex && newIndex <= queueIndex) {
          newQueueIndex++;
        }
        
        set({ queue: newQueue, queueIndex: newQueueIndex });
      },

      removeFromQueue: (index) => {
        const { queue, queueIndex } = get();
        const newQueue = [...queue];
        newQueue.splice(index, 1);
        
        let newQueueIndex = queueIndex;
        if (index < queueIndex) {
          newQueueIndex--;
        } else if (index === queueIndex) {
          if (newQueue.length > 0) {
            const nextIdx = Math.min(index, newQueue.length - 1);
            newQueueIndex = nextIdx;
            get().playTrack(newQueue[nextIdx]);
          } else {
            newQueueIndex = -1;
            set({ currentTrack: null, isPlaying: false });
          }
        }
        
        set({ queue: newQueue, queueIndex: newQueueIndex });
      },

      clearQueue: () => {
        set({ queue: [], originalQueue: [], queueIndex: -1, currentTrack: null, isPlaying: false });
      },

      addNext: (track) => {
        const { queue, queueIndex, originalQueue, currentTrack } = get();
        const trackWithId = { ...track, queueId: generateQueueId() };
        const newQueue = [...queue];
        newQueue.splice(queueIndex + 1, 0, trackWithId);
        
        const newOriginal = [...originalQueue];
        const originalIndex = currentTrack ? originalQueue.findIndex(t => t.queueId === currentTrack.queueId) : -1;
        newOriginal.splice(originalIndex + 1, 0, trackWithId);

        set({ queue: newQueue, originalQueue: newOriginal });
      },

      addToQueue: (track) => {
        const { queue, originalQueue } = get();
        const trackWithId = { ...track, queueId: generateQueueId() };
        set({ 
          queue: [...queue, trackWithId],
          originalQueue: [...originalQueue, trackWithId]
        });
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
    }),
    {
      name: 'zha-playback-storage',
      partialize: (state) => ({
        volume: state.volume,
        repeatMode: state.repeatMode,
        shuffleEnabled: state.shuffleEnabled,
        isMuted: state.isMuted,
      }),
    }
  )
);
