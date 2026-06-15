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
signed-in cookie (verified empirically). Browse/search/home work; only audio is
blocked. So a copy of this app runs on a **home/residential machine**, and Vercel
forwards every `/api/innertube/pipe` request there; the home machine resolves +
streams the audio and Vercel relays it. Works from any network.

### One-time setup (a permanent Cloudflare named tunnel)

A *named* tunnel gives a **stable URL** that survives restarts (unlike a quick
`trycloudflare.com` tunnel, whose URL changes each run). It requires a free
Cloudflare account with a **domain on Cloudflare**.

1. `cloudflared tunnel login` — authenticate and pick your domain.
2. `cloudflared tunnel create zha-resolver` — note the tunnel ID.
3. `cloudflared tunnel route dns zha-resolver resolver.yourdomain.com`
4. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: C:\Users\<you>\.cloudflared\<TUNNEL_ID>.json
   ingress:
     - hostname: resolver.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
5. In the home `frontend/.env.local`, set `RESOLVER_TOKEN=<secret>` (a shared
   secret) and leave `RESOLVER_URL` **unset** (the home resolver must not forward
   to itself).
6. On **Vercel** (Project Settings → Environment Variables): set
   `RESOLVER_URL=https://resolver.yourdomain.com` and `RESOLVER_TOKEN=<same secret>`,
   then redeploy.

### Daily use — one command

Run **`start-zha.bat`** (repo root). It builds + serves the resolver and starts
the named tunnel in two windows. Keep them open — while running, anyone can use
the deployed app and audio plays. Closing the windows takes audio offline.

(Quick alternative without a domain: skip the named tunnel and run
`cloudflared tunnel --url http://localhost:3000`, then paste the printed
`trycloudflare.com` URL into Vercel's `RESOLVER_URL` — but that URL changes every
restart.)

## Notes

- **PO token / streaming:** the audio pipe mints a WebPO token (bgutils-js + jsdom)
  on the first request of each cold instance (~3 s), cached 3 h. jsdom is pinned to
  v25 (CJS deps) so it loads on serverless; `jsdom`/`bgutils-js` are in
  `serverExternalPackages`. `engines.node` is `22.x`. The audio pipe
  (`/api/innertube/pipe`) has `maxDuration = 60`.
- **No FastAPI:** nothing calls `localhost:8000` anymore. The Jam and Blend
  features (which were WebSocket/recompute features on FastAPI) were removed.
- **Lyrics** come from `lrclib.net` directly (no key needed).
