/**
 * Server startup hook (Next.js instrumentation). `register` runs once per server
 * instance, before the server accepts requests.
 *
 * Warm the streaming InnerTube session on boot so the first audio play doesn't
 * pay the ~15s WebPO-token mint (jsdom + BotGuard, see lib/innertube/session.ts).
 *
 * Two guards:
 *  - Only on the Node runtime (the mint needs jsdom; never the Edge runtime).
 *  - Only on a home/residential *resolver* instance — one that resolves audio
 *    itself, i.e. RESOLVER_URL is unset. The Vercel deployment sets RESOLVER_URL
 *    and only forwards to the resolver, so it never mints a token and must not
 *    warm one (it would just burn a serverless cold start).
 *
 * The mint is fired *without* awaiting: `register` must finish before the server
 * is ready, so blocking on the ~15s mint would also delay browse/search. Instead
 * we let it run in the background and the first play either reuses the warm
 * session or (if it lands mid-mint) shares the same in-flight promise.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.RESOLVER_URL) return; // forwarder (Vercel), not a resolver

  const { getStreamingInnertube } = await import('./lib/innertube/session');
  console.log('[Warmup] Minting streaming session on boot (background)...');
  getStreamingInnertube()
    .then(() => console.log('[Warmup] Streaming session ready.'))
    .catch((err) => console.error('[Warmup] Streaming session warmup failed (will mint on first play):', err));
}
