import { Innertube, UniversalCache, Platform } from 'youtubei.js';

/**
 * InnerTube sessions.
 *
 * Two flavours:
 *  - getInnertube()          — plain, tokenless session. Fast, no jsdom. Used by
 *                              browse / search / radio / track (no PO token needed).
 *  - getStreamingInnertube() — session bound to a WebPO token. Only the audio
 *                              pipe needs it: without a PO token googlevideo only
 *                              serves the first ~1 MB and 403s later ranges.
 *
 * The PO token is minted with bgutils-js + a throwaway jsdom for the BotGuard VM.
 * jsdom is heavy / fragile on serverless, so it is imported *dynamically* and the
 * whole mint is best-effort — if it fails we degrade to the tokenless session
 * rather than taking down every route at module load.
 */
const globalForInnertube = global as unknown as {
  innertube: Innertube | undefined;
  innertubeHasToken: boolean | undefined;
  innertubeExpiry: number | undefined;
};

// Re-mint the PO token periodically (its integrity token expires in hours).
const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

// Required for deciphering stream URLs (signature + n-parameter) in Node.
Platform.shim.eval = async (data: { output: string }, env?: Record<string, unknown>) => {
  const keys = Object.keys(env || {});
  const values = Object.values(env || {});
  const fn = new Function(...keys, data.output);
  return fn(...values);
};

// The web player's BotGuard request key (public, stable).
const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

/**
 * Mint a session-bound WebPO token for the given visitor_data. Loads jsdom +
 * bgutils-js lazily (so they never run for browse/search) and tears the jsdom
 * globals down afterwards so the rest of the Node server isn't fooled into
 * thinking it's a browser.
 */
async function generateWebPoToken(visitorData: string): Promise<string> {
  const { JSDOM } = await import('jsdom');
  const { BG, buildURL, GOOG_API_KEY, USER_AGENT } = await import('bgutils-js');

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://www.youtube.com/',
    referrer: 'https://www.youtube.com/',
  });

  const added: string[] = [];
  const setGlobal = (key: string, value: unknown) => {
    if (!(key in globalThis)) {
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
      added.push(key);
    }
  };
  setGlobal('window', dom.window);
  setGlobal('document', dom.window.document);
  setGlobal('location', dom.window.location);
  setGlobal('origin', dom.window.origin);
  setGlobal('navigator', dom.window.navigator);

  try {
    const bgConfig = {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
      globalObj: globalThis,
      identifier: visitorData,
      requestKey: REQUEST_KEY,
    };

    const challenge = await BG.Challenge.create(bgConfig);
    if (!challenge) throw new Error('Could not get BotGuard challenge');

    const interpreterJs = challenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (!interpreterJs) throw new Error('Could not load BotGuard VM');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(interpreterJs)();

    const botguard = await BG.BotGuardClient.create({
      program: challenge.program,
      globalName: challenge.globalName,
      globalObj: globalThis,
    });

    const webPoSignalOutput: unknown[] = [];
    const botguardResponse = await botguard.snapshot({ webPoSignalOutput });

    const itResponse = await fetch(buildURL('GenerateIT', true), {
      method: 'POST',
      headers: {
        'content-type': 'application/json+protobuf',
        'x-goog-api-key': GOOG_API_KEY,
        'x-user-agent': 'grpc-web-javascript/0.1',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify([REQUEST_KEY, botguardResponse]),
    });

    const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] =
      (await itResponse.json()) as [string, number, number, string];

    const minter = await BG.WebPoMinter.create(
      { integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken },
      webPoSignalOutput as never,
    );

    return await minter.mintAsWebsafeString(visitorData);
  } finally {
    for (const key of added) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any)[key];
    }
  }
}

let initPromise: Promise<Innertube | undefined> | null = null;
let tokenPromise: Promise<Innertube | undefined> | null = null;

/** Plain, tokenless InnerTube session (browse / search / radio). No jsdom. */
export async function getInnertube() {
  if (globalForInnertube.innertube && Date.now() < (globalForInnertube.innertubeExpiry ?? 0)) {
    return globalForInnertube.innertube;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[InnerTube] Initializing session...');
    try {
      globalForInnertube.innertube = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
      globalForInnertube.innertubeHasToken = false;
      globalForInnertube.innertubeExpiry = Date.now() + SESSION_TTL_MS;
      console.log('[InnerTube] Session initialized.');
    } catch (error) {
      console.error('[InnerTube] Failed to initialize session:', error);
    } finally {
      initPromise = null;
    }
    return globalForInnertube.innertube;
  })();

  return initPromise;
}

/**
 * InnerTube session bound to a WebPO token (audio streaming). Mints lazily and
 * rebuilds the session; if minting fails (e.g. jsdom unavailable), falls back to
 * the plain tokenless session so playback still works (first chunk only).
 */
export async function getStreamingInnertube() {
  if (
    globalForInnertube.innertube &&
    globalForInnertube.innertubeHasToken &&
    Date.now() < (globalForInnertube.innertubeExpiry ?? 0)
  ) {
    return globalForInnertube.innertube;
  }
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      const seed = await Innertube.create({ retrieve_player: false });
      const visitorData: string | undefined = seed.session.context.client.visitorData;
      if (visitorData) {
        const poToken = await generateWebPoToken(visitorData);
        globalForInnertube.innertube = await Innertube.create({
          cache: new UniversalCache(false),
          generate_session_locally: true,
          po_token: poToken,
          visitor_data: visitorData,
        });
        globalForInnertube.innertubeHasToken = true;
        globalForInnertube.innertubeExpiry = Date.now() + SESSION_TTL_MS;
        console.log('[InnerTube] WebPO token minted (streaming session ready).');
      }
    } catch (err) {
      console.error('[InnerTube] PO token mint failed — using tokenless session:', err);
    } finally {
      tokenPromise = null;
    }
    return globalForInnertube.innertube ?? getInnertube();
  })();

  return tokenPromise;
}

/** TEMP debug: run the full PO-token mint and surface where it fails. */
export async function debugMintToken(): Promise<Record<string, unknown>> {
  try {
    const seed = await Innertube.create({ retrieve_player: false });
    const visitorData: string | undefined = seed.session.context.client.visitorData;
    if (!visitorData) return { ok: false, stage: 'visitorData', error: 'no visitorData' };
    const token = await generateWebPoToken(visitorData);
    return { ok: true, tokenLen: token.length, tokenSample: token.slice(0, 12) };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err?.message || String(e), stack: String(err?.stack || '').split('\n').slice(0, 6) };
  }
}

/** Drop the cached session so the next call re-mints the PO token. */
export function resetInnertube() {
  globalForInnertube.innertube = undefined;
  globalForInnertube.innertubeHasToken = undefined;
  globalForInnertube.innertubeExpiry = undefined;
  initPromise = null;
  tokenPromise = null;
}
