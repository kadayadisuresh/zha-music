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
  autoplayEnabled: boolean;
  playHistory: string[]; // Video IDs
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
  likedTracks: Track[]; // Track objects
  sleepTimerDuration: number | null; // Selected minutes (-1 for end of track, null for off)
  sleepTimerEndTime: number | null; // Timestamp
  sleepTimerTimeoutId: NodeJS.Timeout | null;
  crossfadeDuration: number; // Seconds (0-12), 0 = gapless only
  autoCleanupEnabled: boolean; // Delete downloads not played in 30 days

  // Actions
  updateHistory: (videoId: string) => void;
  toggleAutoplay: () => void;
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
  startRadio: () => Promise<number>;
  toggleLikeTrack: (track: Track) => void;
  isTrackLiked: (trackId: string) => boolean;
  setSleepTimer: (minutes: number | null) => void;
  setCrossfadeDuration: (seconds: number) => void;
  toggleAutoCleanup: () => void;

  // Helpers
  next: () => void;
  previous: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
  shuffleQueue: () => void;
  unshuffleQueue: () => void;
}

const generateQueueId = () => Math.random().toString(36).substring(2, 11);

export const usePlaybackStore = create<PlaybackState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      nextTrack: null,
      dividerIndex: -1,
      autoplayEnabled: true,
      playHistory: [],
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
      likedTracks: [],
      sleepTimerDuration: null,
      sleepTimerEndTime: null,
      sleepTimerTimeoutId: null,
      crossfadeDuration: 0,
      autoCleanupEnabled: false,

      updateHistory: (videoId: string) => {
        set(state => ({
          playHistory: [...state.playHistory.slice(-50), videoId] // Keep last 50
        }));
      },
      toggleAutoplay: () => {
        set(state => {
          const nextState = { autoplayEnabled: !state.autoplayEnabled };
          if (nextState.autoplayEnabled === false) {
            // Remove all autoplay tracks
            const newQueue = state.queue.filter(t => !t.isAutoplay);
            return { ...nextState, queue: newQueue, dividerIndex: -1 };
          }
          return nextState;
        });
      },
      setTrack: (track) => {
        const { queue } = get();
        const index = queue.findIndex(t => t.queueId === track?.queueId);
        const nextTrack = index !== -1 && index < queue.length - 1 ? queue[index + 1] : null;
        set({ currentTrack: track, nextTrack });

        if (track) get().updateHistory(track.id);

        // Trigger autoplay if this is near the end
        if (track && index !== -1 && (queue.length - index <= 5)) {
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
        import('../services/userDataService').then(({ recordPlay }) => recordPlay(track));
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
        const { currentTrack, queue, playHistory, autoplayEnabled } = get();
        if (!currentTrack || !autoplayEnabled) return;

        // Check if we need more tracks
        const remainingAutoplay = queue.slice(get().queueIndex + 1).filter(t => t.isAutoplay).length;
        if (remainingAutoplay > 5) return;

        try {
          const historyQuery = playHistory.map(id => `history=${id}`).join('&');
          const response = await fetch(`/api/radio?videoId=${currentTrack.id}&${historyQuery}`);
          if (!response.ok) return; // Silently fail — radio is optional

          const data = await response.json();
          const suggestions = data.tracks || [];
          if (suggestions.length === 0) return;

          const tracksToAdd = suggestions.slice(0, 20).map((t: any) => ({
            id: t.videoId,
            title: t.title,
            artists: t.artists || [],
            thumbnail: t.thumbnails ? t.thumbnails[0]?.url : undefined,
            queueId: generateQueueId(),
            isAutoplay: true
          }));

          if (tracksToAdd.length > 0) {
            const newQueue = [...get().queue, ...tracksToAdd];
            set({ 
              queue: newQueue,
              originalQueue: [...get().originalQueue, ...tracksToAdd]
            });
          }
        } catch {
          // Radio/autoplay is non-critical — fail silently
        }
      },

      // Explicitly start a radio "station" seeded from the current track:
      // enable autoplay and append a batch of related tracks to the queue.
      // Returns the number of tracks added (0 if none / failed).
      startRadio: async () => {
        const { currentTrack, playHistory } = get();
        if (!currentTrack) return 0;

        if (!get().autoplayEnabled) set({ autoplayEnabled: true });

        try {
          const historyQuery = playHistory.map(id => `history=${id}`).join('&');
          const response = await fetch(`/api/radio?videoId=${currentTrack.id}&${historyQuery}`);
          if (!response.ok) return 0;

          const data = await response.json();
          const suggestions = data.tracks || [];
          if (suggestions.length === 0) return 0;

          // Skip tracks already in the queue to avoid duplicates
          const existingIds = new Set(get().queue.map(t => t.id));
          const tracksToAdd = suggestions
            .filter((t: any) => t.videoId && !existingIds.has(t.videoId))
            .slice(0, 25)
            .map((t: any) => ({
              id: t.videoId,
              title: t.title,
              artists: t.artists || [],
              thumbnail: t.thumbnails ? t.thumbnails[0]?.url : undefined,
              queueId: generateQueueId(),
              isAutoplay: true,
            }));

          if (tracksToAdd.length === 0) return 0;

          const newQueue = [...get().queue, ...tracksToAdd];
          set({
            queue: newQueue,
            originalQueue: [...get().originalQueue, ...tracksToAdd],
            nextTrack: get().nextTrack || tracksToAdd[0],
          });
          return tracksToAdd.length;
        } catch {
          return 0;
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
      },

      toggleLikeTrack: (track) => {
        const { likedTracks } = get();
        const exists = likedTracks.some(t => t.id === track.id);
        if (exists) {
          set({ likedTracks: likedTracks.filter(t => t.id !== track.id) });
        } else {
          set({ likedTracks: [...likedTracks, track] });
        }
      },

      isTrackLiked: (trackId) => {
        return get().likedTracks.some(t => t.id === trackId);
      },

      setSleepTimer: (minutes) => {
        const currentTimeout = get().sleepTimerTimeoutId;
        if (currentTimeout) {
          clearTimeout(currentTimeout);
        }

        if (minutes === null) {
          set({ 
            sleepTimerDuration: null, 
            sleepTimerEndTime: null, 
            sleepTimerTimeoutId: null 
          });
          return;
        }

        if (minutes === -1) {
          set({ 
            sleepTimerDuration: -1, 
            sleepTimerEndTime: null, 
            sleepTimerTimeoutId: null 
          });
          return;
        }

        const durationMs = minutes * 60 * 1000;
        const endTime = Date.now() + durationMs;

        const timeoutId = setTimeout(() => {
          import('../audio/AudioEngine').then(({ audioEngine }) => {
            // Fade out over 3 seconds, then stop (SRD 5.20)
            audioEngine.fadeOutAndPause(3000);
          });
          get().setSleepTimer(null);
        }, durationMs);

        set({ 
          sleepTimerDuration: minutes, 
          sleepTimerEndTime: endTime, 
          sleepTimerTimeoutId: timeoutId 
        });
      },

      setCrossfadeDuration: (seconds) => {
        const clamped = Math.max(0, Math.min(12, Math.round(seconds)));
        set({ crossfadeDuration: clamped });
      },

      toggleAutoCleanup: () => set((state) => ({ autoCleanupEnabled: !state.autoCleanupEnabled })),

      skipNext: () => get().next(),
      skipPrevious: () => get().previous()
    }),    {
      name: 'zha-playback-storage',
      partialize: (state) => ({
        volume: state.volume,
        repeatMode: state.repeatMode,
        shuffleEnabled: state.shuffleEnabled,
        isMuted: state.isMuted,
        likedTracks: state.likedTracks || [],
        crossfadeDuration: state.crossfadeDuration,
        autoCleanupEnabled: state.autoCleanupEnabled,
        autoplayEnabled: state.autoplayEnabled,
      }),
    }
  )
);
