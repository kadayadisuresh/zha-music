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
  isAutoplay?: boolean;
}

interface PlaybackState {
  dividerIndex: number;
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
  fetchAutoplay: () => Promise<void>;

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
      dividerIndex: -1,
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

      setTrack: (track) => {
        const { queue } = get();
        const index = queue.findIndex(t => t.queueId === track?.queueId);
        const nextTrack = index !== -1 && index < queue.length - 1 ? queue[index + 1] : null;
        set({ currentTrack: track, nextTrack });

        // Trigger autoplay if this is the last track
        if (track && index !== -1 && index === queue.length - 1) {
          get().fetchAutoplay();
        }
      },
      setNextTrack: (track) => set({ nextTrack: track }),
      setQueue: (queue) => {
        const queueWithIds = queue.map(t => ({ ...t, queueId: t.queueId || generateQueueId() }));
        set({ queue: queueWithIds, originalQueue: [...queueWithIds] });
      },
      setQueueIndex: (queueIndex) => {
        const { queue } = get();
        const track = queue[queueIndex];
        const nextTrack = queueIndex < queue.length - 1 ? queue[queueIndex + 1] : null;
        set({ queueIndex, nextTrack });

        // Trigger autoplay if we just moved to the last track
        if (queueIndex !== -1 && queueIndex === queue.length - 1) {
          get().fetchAutoplay();
        }
      },

      playTrack: (track) => {
        const { queue } = get();
        let index = queue.findIndex(t => t.queueId === track.queueId);

        // If track not in queue, add it and play
        if (index === -1) {
          const trackWithId = { ...track, queueId: track.queueId || generateQueueId() };
          const newQueue = [...queue, trackWithId];
          set({ queue: newQueue, originalQueue: [...get().originalQueue, trackWithId] });
          index = newQueue.length - 1;
        }

        get().setQueueIndex(index);
        set({ currentTrack: track, isPlaying: true });

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

        const nextTrack = shuffled.length > 1 ? shuffled[1] : null;

        set({
          shuffleEnabled: true,
          queue: shuffled,
          queueIndex: currentTrack ? 0 : -1,
          nextTrack
        });
      },

      unshuffleQueue: () => {
        const { originalQueue, currentTrack } = get();
        const newIndex = currentTrack ? originalQueue.findIndex(t => t.queueId === currentTrack.queueId) : -1;
        const nextTrack = (newIndex !== -1 && newIndex < originalQueue.length - 1) ? originalQueue[newIndex + 1] : null;

        set({
          shuffleEnabled: false,
          queue: [...originalQueue],
          queueIndex: newIndex,
          nextTrack
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

        const nextTrack = (newQueueIndex !== -1 && newQueueIndex < newQueue.length - 1) ? newQueue[newQueueIndex + 1] : null;

        set({ queue: newQueue, queueIndex: newQueueIndex, nextTrack });
      },

      removeFromQueue: (index) => {
        const { queue, queueIndex, dividerIndex } = get();
        const newQueue = [...queue];
        const removedItem = newQueue.splice(index, 1)[0];
        
        let newDividerIndex = dividerIndex;
        if (newDividerIndex !== -1) {
          if (index < newDividerIndex) {
            newDividerIndex--;
          } else if (index === newDividerIndex) {
            // Check if there are any more manual tracks
            const hasManual = newQueue.slice(0, newDividerIndex).some(t => !t.isAutoplay);
            if (!hasManual) newDividerIndex = -1;
          }
        }

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

        const nextTrack = (newQueueIndex !== -1 && newQueueIndex < newQueue.length - 1) ? newQueue[newQueueIndex + 1] : null;

        set({ queue: newQueue, queueIndex: newQueueIndex, nextTrack, dividerIndex: newDividerIndex });
      },

      clearQueue: () => {
        set({ queue: [], originalQueue: [], queueIndex: -1, currentTrack: null, nextTrack: null, isPlaying: false, dividerIndex: -1 });
      },

      addNext: (track) => {
        const { queue, queueIndex, originalQueue, currentTrack } = get();
        const trackWithId = { ...track, queueId: generateQueueId() };  
        const newQueue = [...queue];
        newQueue.splice(queueIndex + 1, 0, trackWithId);

        const newOriginal = [...originalQueue];
        const originalIndex = currentTrack ? originalQueue.findIndex(t => t.queueId === currentTrack.queueId) : -1;
        newOriginal.splice(originalIndex + 1, 0, trackWithId);

        set({ queue: newQueue, originalQueue: newOriginal, nextTrack: trackWithId });
      },

      addToQueue: (track) => {
        const { queue, originalQueue, queueIndex, dividerIndex } = get();
        const trackWithId = { ...track, queueId: generateQueueId() };
        
        let newQueue = [...queue];
        let newDividerIndex = dividerIndex;

        if (track.isAutoplay) {
          // If adding autoplay, just append
          newQueue.push(trackWithId);
          if (newDividerIndex === -1) {
            newDividerIndex = newQueue.length - 1;
          }
        } else {
          // If adding manual, insert before divider if it exists
          if (newDividerIndex !== -1) {
            newQueue.splice(newDividerIndex, 0, trackWithId);
            newDividerIndex++;
          } else {
            newQueue.push(trackWithId);
          }
        }

        const nextTrack = (queueIndex !== -1 && queueIndex === queue.length - 1) ? trackWithId : get().nextTrack;

        set({
          queue: newQueue,
          originalQueue: [...originalQueue, trackWithId],
          nextTrack,
          dividerIndex: newDividerIndex
        });
      },

      fetchAutoplay: async () => {
        const { currentTrack, queue } = get();
        if (!currentTrack) return;

        // Don't fetch if we already have autoplay tracks coming up
        const hasAutoplayDownstream = queue.slice(get().queueIndex + 1).some(t => t.isAutoplay);
        if (hasAutoplayDownstream) return;

        try {
          const response = await fetch(`/api/innertube/upnext?videoId=${currentTrack.id}`);
          if (!response.ok) throw new Error('Failed to fetch autoplay suggestions');

          const suggestions = await response.json();
          const tracksToAdd = suggestions.slice(0, 10).map((t: any) => ({
            ...t,
            queueId: generateQueueId(),
            isAutoplay: true
          }));

          const newQueue = [...get().queue, ...tracksToAdd];
          set({ 
            queue: newQueue,
            originalQueue: [...get().originalQueue, ...tracksToAdd]
          });

          // Update nextTrack if it was null
          if (!get().nextTrack && tracksToAdd.length > 0) {
            set({ nextTrack: tracksToAdd[0] });
          }
        } catch (error) {
          console.error('Error fetching autoplay:', error);
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
          get().setQueueIndex(nextIdx);
          get().playTrack(nextTrack);
        } else if (repeatMode === 'all' && queue.length > 0) {
          const nextTrack = queue[0];
          get().setQueueIndex(0);
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
          get().setQueueIndex(prevIdx);
          get().playTrack(prevTrack);
        } else {
          // If at the beginning of queue, restart the song
          import('../audio/AudioEngine').then(({ audioEngine }) => {   
            audioEngine.seek(0);
          });
        }
      }
    }),    {
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
