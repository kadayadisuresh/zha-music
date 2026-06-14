# Deploying ZHA

As of Phase 17, ZHA is a **single Next.js app** (`frontend/`) backed by **Supabase**
(auth, Postgres + RLS, Realtime). There is no separate server — the former FastAPI
backend has been removed. Audio resolution/streaming, search, browse, radio, and
the image proxy all run inside Next.js route handlers (youtubei.js).

Deploy target: **Vercel** (frontend) + **Supabase** (data/auth/realtime).

---

## 1. Supabase (one-time)

1. Create a Supabase project (or use the existing one).
2. **Apply the migrations** in the SQL Editor, in order:
   - `supabase/migrations/0001_phase17_identity_and_rls.sql`
   - `supabase/migrations/0002_phase17_fix_rls_recursion.sql`
   - `supabase/migrations/0003_phase17_join_via_token.sql`
3. **Auth → Providers:** enable **Google** and set the OAuth client ID/secret.
4. **Auth → URL Configuration → Redirect URLs:** add your origins, e.g.
   - `http://localhost:3000/**` (local dev)
   - `https://YOUR-APP.vercel.app/**` (production)
   - any preview-deploy pattern you want to support.

## 2. Vercel

1. **Import the GitHub repo.**
2. **Root Directory:** set to **`frontend`** (the Next.js app lives there).
3. **Framework Preset:** Next.js (auto-detected). Build command comes from
   `frontend/vercel.json` (`next build --webpack`) — webpack is required for the
   serwist service worker.
4. **Environment Variables** (Production + Preview) — see `frontend/.env.example`:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon (public) key |

   These two are the **only** runtime variables. The service-role key is **not**
   used at runtime — do **not** add it to Vercel.
5. Deploy.

## Notes

- **PO token / streaming:** `app/api/innertube/*` mint a WebPO token (bgutils-js +
  jsdom) on the first request of each cold function instance (~3 s), then cache it
  for 3 h. `jsdom`/`bgutils-js` are in `serverExternalPackages` so they aren't
  bundled. The audio pipe (`/api/innertube/pipe`) has `maxDuration = 60`.
- **No FastAPI:** nothing calls `localhost:8000` anymore. The Jam and Blend
  features (which were WebSocket/recompute features on FastAPI) were removed.
- **Lyrics** come from `lrclib.net` directly (no key needed).
