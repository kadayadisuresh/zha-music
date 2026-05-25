import { create } from 'zustand';

export interface Track {
  id: string;
  title: string;
  artist: string;
  cover?: string;
}

interface PlaybackState {
  currentTrack: Track | null;
  nextTrack: Track | null;
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
  setPlaying: (isPlaying: boolean) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (currentTime: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setNetworkType: (type: string) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  currentTrack: null,
  nextTrack: null,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  volume: 1,
  isMuted: false,
  isLoading: false,
  networkType: '4g',

  setTrack: (track) => set({ currentTrack: track }),
  setNextTrack: (track) => set({ nextTrack: track }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (duration) => set({ duration }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setNetworkType: (networkType) => set({ networkType }),
}));
