import { create } from 'zustand';
import { apiClient } from '../api/client';

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
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
    } catch (error: any) {
      set({ user: null, error: error.message || 'Session invalid', isLoading: false });
    }
  },
  
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiClient('/auth/session', { method: 'DELETE' });
      set({ user: null, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Logout failed', isLoading: false });
    }
  },
}));
