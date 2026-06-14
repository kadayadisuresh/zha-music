-- ============================================================================
-- Phase 17 · Slice 3 — accept a collaborative-playlist invite via token.
--
-- Problem: a user joining via an invite link is neither the owner nor (yet) a
-- collaborator, so RLS on playlist_invite_tokens (pit_owner: owner-only) won't
-- even let them READ the token to validate it. Classic invite-join RLS gap.
--
-- Fix: a SECURITY DEFINER function that runs as the function owner (bypasses
-- RLS) to look up + validate the token and insert the caller as a collaborator.
-- Same pattern as the 0002 helpers.
--
-- Minting tokens needs no function — pit_owner already lets the owner INSERT,
-- and playlists_update lets the owner flip is_collaborative.
--
-- Idempotent (CREATE OR REPLACE). Apply in the Supabase SQL Editor.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.join_playlist_via_token(p_token text)
  RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_playlist_id integer;
  v_expires_at  timestamptz;
  v_owner       uuid;
  v_uid         uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT playlist_id, expires_at
    INTO v_playlist_id, v_expires_at
    FROM public.playlist_invite_tokens
   WHERE token = p_token;

  IF v_playlist_id IS NULL OR (v_expires_at IS NOT NULL AND v_expires_at < now()) THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  SELECT owner_id INTO v_owner FROM public.playlists WHERE id = v_playlist_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Playlist not found';
  END IF;

  -- The owner doesn't need a collaborator row; everyone else gets one (idempotent).
  IF v_owner <> v_uid THEN
    INSERT INTO public.playlist_collaborators (playlist_id, user_id, role)
    VALUES (v_playlist_id, v_uid, 'editor')
    ON CONFLICT (playlist_id, user_id) DO NOTHING;
  END IF;

  RETURN v_playlist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_playlist_via_token(text) TO authenticated;

COMMIT;
