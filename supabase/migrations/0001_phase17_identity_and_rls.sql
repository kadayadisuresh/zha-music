-- ============================================================================
-- Phase 17 · Slice 2 — Map legacy FastAPI users → Supabase auth.users + enable RLS
--
--   !!! REVIEW CAREFULLY. Run as the postgres / service_role role.            !!!
--   !!! Take a Supabase backup FIRST (Dashboard → Database → Backups).        !!!
--
-- Identity model after this runs: public.users becomes a "profile" table keyed by
-- the SAME id as auth.users, for every user who has signed in via Supabase at
-- least once. Every user-owned row is re-pointed to that id, so RLS policies of
-- the form  auth.uid() = <user column>  grant each user access to their own data.
--
-- Users who have NOT yet signed in via Supabase keep their legacy id (data
-- untouched). Re-run this migration after they sign in once.  IMPORTANT: have all
-- real users sign in via Supabase BEFORE applying, or their rows will block the
-- FK re-creation in step 4 (they'd reference an id that isn't in public.users yet).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PRE-FLIGHT — run these SELECTs first; they change nothing. Verify the counts
--    look right and that "unmatched" is empty (or only abandoned accounts).
-- ─────────────────────────────────────────────────────────────────────────────
--   SELECT count(*) AS legacy_users FROM public.users;
--   SELECT count(*) AS will_remap
--     FROM public.users u JOIN auth.users a ON lower(a.email) = lower(u.email)
--     WHERE u.id <> a.id;
--   SELECT u.email AS unmatched_must_sign_in_first
--     FROM public.users u
--     WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE lower(a.email) = lower(u.email));

BEGIN;

-- 1. old → new identity map (matched by email; only Supabase-auth users appear).
CREATE TEMP TABLE _id_map ON COMMIT DROP AS
SELECT u.id AS old_id, a.id AS new_id
FROM public.users u
JOIN auth.users a ON lower(a.email) = lower(u.email)
WHERE u.id <> a.id;

-- 2. Drop every FK that references public.users (auto-generated names → discover
--    them dynamically rather than guessing).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'f' AND confrelid = 'public.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 3. Re-point the profile row itself, then every child user-FK column.
UPDATE public.users                u SET id           = m.new_id FROM _id_map m WHERE u.id           = m.old_id;
UPDATE public.playlists            t SET owner_id     = m.new_id FROM _id_map m WHERE t.owner_id     = m.old_id;
UPDATE public.playlist_collaborators t SET user_id   = m.new_id FROM _id_map m WHERE t.user_id      = m.old_id;
UPDATE public.playlist_invite_tokens t SET created_by= m.new_id FROM _id_map m WHERE t.created_by   = m.old_id;
UPDATE public.playlist_messages    t SET user_id     = m.new_id FROM _id_map m WHERE t.user_id      = m.old_id;
UPDATE public.play_history         t SET user_id     = m.new_id FROM _id_map m WHERE t.user_id      = m.old_id;
UPDATE public.followed_artists     t SET user_id     = m.new_id FROM _id_map m WHERE t.user_id      = m.old_id;
UPDATE public.liked_albums         t SET user_id     = m.new_id FROM _id_map m WHERE t.user_id      = m.old_id;
UPDATE public.jam_sessions         t SET host_id     = m.new_id FROM _id_map m WHERE t.host_id      = m.old_id;
UPDATE public.jam_participants     t SET user_id     = m.new_id FROM _id_map m WHERE t.user_id      = m.old_id;
UPDATE public.blends               t SET user1_id    = m.new_id FROM _id_map m WHERE t.user1_id     = m.old_id;
UPDATE public.blends               t SET user2_id    = m.new_id FROM _id_map m WHERE t.user2_id     = m.old_id;
UPDATE public.blend_invites        t SET from_user_id= m.new_id FROM _id_map m WHERE t.from_user_id = m.old_id;
UPDATE public.blend_invites        t SET to_user_id  = m.new_id FROM _id_map m WHERE t.to_user_id   = m.old_id;

-- 4. Re-add the FKs (public.users is now keyed by the auth id).
ALTER TABLE public.playlists              ADD CONSTRAINT playlists_owner_id_fkey              FOREIGN KEY (owner_id)     REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.playlist_collaborators ADD CONSTRAINT playlist_collaborators_user_id_fkey  FOREIGN KEY (user_id)      REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.playlist_invite_tokens ADD CONSTRAINT playlist_invite_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.playlist_messages      ADD CONSTRAINT playlist_messages_user_id_fkey       FOREIGN KEY (user_id)      REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.play_history           ADD CONSTRAINT play_history_user_id_fkey            FOREIGN KEY (user_id)      REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.followed_artists       ADD CONSTRAINT followed_artists_user_id_fkey        FOREIGN KEY (user_id)      REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.liked_albums           ADD CONSTRAINT liked_albums_user_id_fkey            FOREIGN KEY (user_id)      REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.jam_sessions           ADD CONSTRAINT jam_sessions_host_id_fkey            FOREIGN KEY (host_id)      REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.jam_participants       ADD CONSTRAINT jam_participants_user_id_fkey        FOREIGN KEY (user_id)      REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.blends                 ADD CONSTRAINT blends_user1_id_fkey                 FOREIGN KEY (user1_id)     REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.blends                 ADD CONSTRAINT blends_user2_id_fkey                 FOREIGN KEY (user2_id)     REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.blend_invites          ADD CONSTRAINT blend_invites_from_user_id_fkey      FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.blend_invites          ADD CONSTRAINT blend_invites_to_user_id_fkey        FOREIGN KEY (to_user_id)   REFERENCES public.users(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Row-Level Security. Default-deny once enabled; policies below grant access.
--    NOTE: the supabase-js anon key respects RLS; the service_role key bypasses
--    it (used only by admin/migration scripts).
-- ─────────────────────────────────────────────────────────────────────────────

-- profile row (settings): only yourself
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON public.users
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- playlists: owner full control; readable if collaborative or you're a collaborator
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY playlists_select ON public.playlists FOR SELECT USING (
  owner_id = auth.uid()
  OR is_collaborative = true
  OR EXISTS (SELECT 1 FROM public.playlist_collaborators c
             WHERE c.playlist_id = playlists.id AND c.user_id = auth.uid())
);
CREATE POLICY playlists_insert ON public.playlists FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY playlists_update ON public.playlists FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY playlists_delete ON public.playlists FOR DELETE USING (owner_id = auth.uid());

-- playlist_songs: gated through the parent playlist
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY playlist_songs_select ON public.playlist_songs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_songs.playlist_id AND (
    p.owner_id = auth.uid() OR p.is_collaborative = true
    OR EXISTS (SELECT 1 FROM public.playlist_collaborators c WHERE c.playlist_id = p.id AND c.user_id = auth.uid())
  ))
);
CREATE POLICY playlist_songs_write ON public.playlist_songs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_songs.playlist_id AND (
    p.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.playlist_collaborators c WHERE c.playlist_id = p.id AND c.user_id = auth.uid())
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_songs.playlist_id AND (
    p.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.playlist_collaborators c WHERE c.playlist_id = p.id AND c.user_id = auth.uid())
  ))
);

-- personal lists: only yours
ALTER TABLE public.liked_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY liked_albums_owner ON public.liked_albums FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.followed_artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY followed_artists_owner ON public.followed_artists FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY play_history_owner ON public.play_history FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- collaboration tables: gated through the parent playlist (owner manages; members read)
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_select ON public.playlist_collaborators FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_collaborators.playlist_id AND p.owner_id = auth.uid())
);
CREATE POLICY pc_owner_manage ON public.playlist_collaborators FOR ALL USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_collaborators.playlist_id AND p.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_collaborators.playlist_id AND p.owner_id = auth.uid())
);
-- self-join via a valid invite (token check is done in app + RLS on the playlist)
CREATE POLICY pc_self_join ON public.playlist_collaborators FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER TABLE public.playlist_invite_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY pit_owner ON public.playlist_invite_tokens FOR ALL USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_invite_tokens.playlist_id AND p.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_invite_tokens.playlist_id AND p.owner_id = auth.uid())
);

ALTER TABLE public.playlist_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_member_read ON public.playlist_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_messages.playlist_id AND (
    p.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.playlist_collaborators c WHERE c.playlist_id = p.id AND c.user_id = auth.uid())
  ))
);
CREATE POLICY pm_member_send ON public.playlist_messages FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_messages.playlist_id AND (
    p.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.playlist_collaborators c WHERE c.playlist_id = p.id AND c.user_id = auth.uid())
  ))
);

-- jam + blend: basic owner/participant access; refined in Slice 3 (Realtime).
ALTER TABLE public.jam_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY jam_host ON public.jam_sessions FOR ALL USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY jam_participant_read ON public.jam_sessions FOR SELECT USING (
  host_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.jam_participants jp WHERE jp.session_id = jam_sessions.id AND jp.user_id = auth.uid())
);

ALTER TABLE public.jam_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY jp_self ON public.jam_participants FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.blends ENABLE ROW LEVEL SECURITY;
CREATE POLICY blends_members ON public.blends FOR ALL USING (user1_id = auth.uid() OR user2_id = auth.uid())
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

ALTER TABLE public.blend_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY blend_invites_members ON public.blend_invites FOR ALL USING (from_user_id = auth.uid() OR to_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. (Optional, recommended) keep public.users synced with auth.users for FUTURE
--    sign-ups, so a profile row is created automatically. Apply separately.
-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
--   LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   INSERT INTO public.users (id, email, display_name, avatar_url)
--   VALUES (NEW.id, NEW.email,
--           NEW.raw_user_meta_data->>'full_name',
--           NEW.raw_user_meta_data->>'avatar_url')
--   ON CONFLICT (id) DO NOTHING;
--   RETURN NEW;
-- END $$;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
