import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SearchState {
  recentSearches: string[];
  addSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearHistory: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recentSearches: [],
      addSearch: (query: string) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;
        
        set((state) => {
          const filtered = state.recentSearches.filter((s) => s !== trimmedQuery);
          const newSearches = [trimmedQuery, ...filtered].slice(0, 10);
          return { recentSearches: newSearches };
        });
      },
      removeSearch: (query: string) => {
        set((state) => ({
          recentSearches: state.recentSearches.filter((s) => s !== query),
        }));
      },
      clearHistory: () => set({ recentSearches: [] }),
    }),
    {
      name: 'zha-search-history',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
