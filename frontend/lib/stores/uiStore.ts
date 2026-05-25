import { create } from 'zustand';

interface UIState {
  activeThumbnail: string | null;
  isPlayerExpanded: boolean;
  setActiveThumbnail: (thumbnail: string | null) => void;
  setPlayerExpanded: (expanded: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeThumbnail: null,
  isPlayerExpanded: false,
  setActiveThumbnail: (thumbnail) => set({ activeThumbnail: thumbnail }),
  setPlayerExpanded: (isPlayerExpanded) => set({ isPlayerExpanded }),
}));
