import { create } from 'zustand';
import { getSupabase } from '../supabase/client';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

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

/** Map a Supabase auth user onto the app's User shape. Google identities expose
 *  name/avatar via user_metadata. Settings like crossfade live in the data layer
 *  (migrated in Slice 2), so they're left undefined here (callers default them). */
function mapUser(su: SupabaseUser | null | undefined): User | null {
  if (!su) return null;
  const m = (su.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    id: su.id,
    email: su.email ?? '',
    display_name: m.full_name || m.name || (su.email ? su.email.split('@')[0] : undefined),
    avatar_url: m.avatar_url || m.picture,
  };
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  /** Load the current Supabase session and subscribe to auth changes (once). */
  checkSession: () => Promise<void>;
  /** Start the Google OAuth flow via Supabase (redirects the browser). Pass
   *  `redirectTo` to return somewhere other than the app origin after auth. */
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

// Module-level guard so we only attach the auth listener once across re-renders.
let authSubscribed = false;

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),

  // Supabase Auth is the source of truth (Phase 17, replaces FastAPI /auth/me).
  checkSession: async () => {
    set({ isLoading: true, error: null });
    const supabase = getSupabase();
    try {
      const { data } = await supabase.auth.getSession();
      set({ user: mapUser(data.session?.user), isLoading: false });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Session check failed';
      set({ user: null, error: msg, isLoading: false });
    }
    // Keep the store in sync with sign-in / sign-out / token refresh.
    if (!authSubscribed) {
      authSubscribed = true;
      supabase.auth.onAuthStateChange((_event, session: Session | null) => {
        set({ user: mapUser(session?.user) });
      });
    }
  },

  signInWithGoogle: async (redirectTo?: string) => {
    set({ error: null });
    const supabase = getSupabase();
    const target = redirectTo ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: target },
    });
    if (error) set({ error: error.message });
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await getSupabase().auth.signOut();
      set({ user: null, isLoading: false });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Logout failed';
      set({ error: msg, isLoading: false });
    }
  },
}));
