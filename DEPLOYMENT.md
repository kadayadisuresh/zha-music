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
   | `RESOLVER_URL` | URL of your home audio resolver — **required for audio playback** (see below) |
   | `RESOLVER_TOKEN` | a shared secret protecting the resolver (optional but recommended) |

   The two `NEXT_PUBLIC_*` vars are public (RLS-protected). `RESOLVER_URL` /
   `RESOLVER_TOKEN` are server-only. The Supabase service-role key is **not** used
   at runtime — do **not** add it to Vercel.
5. Deploy.

## Audio playback needs a home resolver (Vercel can't stream YouTube)

YouTube hard-blocks **streaming** from datacenter IPs (Vercel, AWS, GCP…) with
"Sign in to confirm you're not a bot" — even with a valid PO token *and* a
signed-in cookie (verified empirically). Browse/search/home work; only the audio
stream is blocked. The fix is to resolve audio from a **residential IP** and have
Vercel forward to it:

1. **Run this app on a home machine** (residential IP — not blocked):
   ```
   cd frontend
   npm run build && npm start      # serves on http://localhost:3000
   ```
   Do **not** set `RESOLVER_URL` here — only the Vercel deployment sets it.
   (Optional: set `RESOLVER_TOKEN` in the home `.env.local` to the same secret you
   put on Vercel. For full playback this machine needs the PO-token mint to work,
   which it does locally; `YOUTUBE_COOKIE` is optional on a residential IP.)
2. **Expose it with a tunnel**, e.g. Cloudflare Tunnel (no account needed for a
   quick tunnel):
   ```
   cloudflared tunnel --url http://localhost:3000
   ```
   Copy the printed `https://<random>.trycloudflare.com` URL.
3. **On Vercel**, set `RESOLVER_URL` to that tunnel URL (and `RESOLVER_TOKEN` to a
   matching secret if you set one), then redeploy. Vercel forwards every
   `/api/innertube/pipe` request to the home resolver and relays the audio.

Only the home machine talks to YouTube for streaming, so the datacenter-IP block
no longer applies. The catch: the home machine + tunnel must stay running. If
`RESOLVER_URL` is unset, the app still browses/searches but won't play audio.

## Notes

- **PO token / streaming:** the audio pipe mints a WebPO token (bgutils-js + jsdom)
  on the first request of each cold instance (~3 s), cached 3 h. jsdom is pinned to
  v25 (CJS deps) so it loads on serverless; `jsdom`/`bgutils-js` are in
  `serverExternalPackages`. `engines.node` is `22.x`. The audio pipe
  (`/api/innertube/pipe`) has `maxDuration = 60`.
- **No FastAPI:** nothing calls `localhost:8000` anymore. The Jam and Blend
  features (which were WebSocket/recompute features on FastAPI) were removed.
- **Lyrics** come from `lrclib.net` directly (no key needed).
