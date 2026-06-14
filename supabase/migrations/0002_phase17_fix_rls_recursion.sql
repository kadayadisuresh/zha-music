-- ============================================================================
-- Phase 17 · Slice 2 FIX — break RLS infinite recursion (42P17) on the playlist
-- family.
--
-- Problem: the playlists / playlist_collaborators / playlist_songs /
-- playlist_messages SELECT policies referenced each other, so evaluating one
-- policy triggered another table's RLS, which referenced the first again →
-- "infinite recursion detected in policy for relation playlists".
--
-- Fix: perform the cross-table ownership/membership checks inside SECURITY
-- DEFINER functions. Those run as the function owner and BYPASS RLS, so calling
-- them from a policy does NOT re-enter another policy.
--
-- Idempotent (CREATE OR REPLACE + DROP POLICY IF EXISTS). Apply in the Supabase
-- SQL Editor. Atomic (BEGIN/COMMIT).
-- ============================================================================

BEGIN;

-- ── SECURITY DEFINER helpers (bypass RLS) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.playlist_is_owner(pid integer)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.playlists WHERE id = pid AND owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.playlist_is_collaborator(pid integer)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.playlist_collaborators
                 WHERE playlist_id = pid AND user_id = auth.uid());
$$;

-- owner OR collaborator OR (the playlist is collaborative → anyone can read)
CREATE OR REPLACE FUNCTION public.playlist_can_read(pid integer)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.playlists p WHERE p.id = pid AND (
      p.owner_id = auth.uid() OR p.is_collaborative
      OR EXISTS (SELECT 1 FROM public.playlist_collaborators c
                 WHERE c.playlist_id = p.id AND c.user_id = auth.uid())
    )
  );
$$;

-- owner OR collaborator (write access to a playlist's contents)
CREATE OR REPLACE FUNCTION public.playlist_can_write(pid integer)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.playlists p WHERE p.id = pid AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.playlist_collaborators c
                 WHERE c.playlist_id = p.id AND c.user_id = auth.uid())
    )
  );
$$;

GRANT EXECUTE ON FUNCTION
  public.playlist_is_owner(integer),
  public.playlist_is_collaborator(integer),
  public.playlist_can_read(integer),
  public.playlist_can_write(integer)
  TO anon, authenticated;

-- ── Replace the recursive policies ───────────────────────────────────────────

-- playlists
DROP POLICY IF EXISTS playlists_select ON public.playlists;
CREATE POLICY playlists_select ON public.playlists FOR SELECT USING (
  owner_id = auth.uid() OR is_collaborative OR public.playlist_is_collaborator(id)
);

-- playlist_collaborators
DROP POLICY IF EXISTS pc_select ON public.playlist_collaborators;
CREATE POLICY pc_select ON public.playlist_collaborators FOR SELECT USING (
  user_id = auth.uid() OR public.playlist_is_owner(playlist_id)
);
DROP POLICY IF EXISTS pc_owner_manage ON public.playlist_collaborators;
CREATE POLICY pc_owner_manage ON public.playlist_collaborators FOR ALL
  USING (public.playlist_is_owner(playlist_id))
  WITH CHECK (public.playlist_is_owner(playlist_id));
-- pc_self_join (INSERT WITH CHECK user_id = auth.uid()) is non-recursive; left as is.

-- playlist_songs
DROP POLICY IF EXISTS playlist_songs_select ON public.playlist_songs;
CREATE POLICY playlist_songs_select ON public.playlist_songs FOR SELECT
  USING (public.playlist_can_read(playlist_id));
DROP POLICY IF EXISTS playlist_songs_write ON public.playlist_songs;
CREATE POLICY playlist_songs_write ON public.playlist_songs FOR ALL
  USING (public.playlist_can_write(playlist_id))
  WITH CHECK (public.playlist_can_write(playlist_id));

-- playlist_invite_tokens
DROP POLICY IF EXISTS pit_owner ON public.playlist_invite_tokens;
CREATE POLICY pit_owner ON public.playlist_invite_tokens FOR ALL
  USING (public.playlist_is_owner(playlist_id))
  WITH CHECK (public.playlist_is_owner(playlist_id));

-- playlist_messages
DROP POLICY IF EXISTS pm_member_read ON public.playlist_messages;
CREATE POLICY pm_member_read ON public.playlist_messages FOR SELECT
  USING (public.playlist_can_write(playlist_id));
DROP POLICY IF EXISTS pm_member_send ON public.playlist_messages;
CREATE POLICY pm_member_send ON public.playlist_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.playlist_can_write(playlist_id));

COMMIT;
