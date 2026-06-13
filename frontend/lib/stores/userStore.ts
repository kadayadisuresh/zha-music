import { create } from 'zustand';
import { apiClient } from '../api/client';

export interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  crossfade_seconds?: number;
  autoplay_enabled?: boolean;
  is_active?: boolean;
  is_superuser?: boolean;
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  
  setUser: (user) => set({ user }),
  
  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await apiClient<User>('/auth/me');
      set({ user, isLoading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Session invalid';
      set({ user: null, error: errorMessage, isLoading: false });
    }
  },
  
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiClient('/auth/session', { method: 'DELETE' });
      set({ user: null, isLoading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      set({ error: errorMessage, isLoading: false });
    }
  },
}));
