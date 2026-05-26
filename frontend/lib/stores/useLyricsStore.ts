import { create } from 'zustand';
import { LyricsLine } from '../utils/lyricsParser';

interface LyricsState {
  lyrics: LyricsLine[];
  currentLineIndex: number;
  offset: number;
  setLyrics: (lyrics: LyricsLine[]) => void;
  setCurrentLineIndex: (index: number) => void;
  setOffset: (offset: number) => void;
}

export const useLyricsStore = create<LyricsState>((set) => ({
  lyrics: [],
  currentLineIndex: -1,
  offset: 0,
  setLyrics: (lyrics) => set({ lyrics }),
  setCurrentLineIndex: (index) => set({ currentLineIndex: index }),
  setOffset: (offset) => set({ offset }),
}));
