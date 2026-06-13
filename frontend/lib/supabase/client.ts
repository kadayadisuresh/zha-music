import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Phase 17 — single browser-side Supabase client.
 *
 * The anon (publishable) key is safe to expose in the browser: access is
 * enforced server-side by Postgres Row-Level Security, not by hiding the key.
 * supabase-js talks to Supabase over HTTPS (PostgREST + Realtime), so it does
 * NOT consume raw Postgres connections — which also sidesteps the Supabase
 * session-pooler 15-connection limit the FastAPI backend kept hitting.
 *
 * This module is scaffolding for the migration: nothing imports it yet, so the
 * app is unaffected until Slice 1 (auth) wires it in. It only throws when used
 * without the env vars configured.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let browserClient: SupabaseClient | null = null;

/** Lazily-created singleton browser client. */
export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local (see SRD §14, Phase 17).'
    );
  }
  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // needed for the OAuth redirect callback
    },
  });
  return browserClient;
}
