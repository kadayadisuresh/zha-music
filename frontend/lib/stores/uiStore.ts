import { create } from 'zustand';

interface UIState {
  activeThumbnail: string | null;
  setActiveThumbnail: (thumbnail: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeThumbnail: null,
  setActiveThumbnail: (thumbnail) => set({ activeThumbnail: thumbnail }),
}));
