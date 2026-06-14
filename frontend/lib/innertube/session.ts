import { Innertube, UniversalCache, Platform } from 'youtubei.js';
import { BG, buildURL, GOOG_API_KEY, USER_AGENT } from 'bgutils-js';
import { JSDOM } from 'jsdom';

/**
 * InnerTube session with a WebPO (Proof of Origin) token.
 *
 * Phase 17 · Slice 4: without a PO token, googlevideo only serves the first
 * ~1 MB from byte 0 and 403s every later range, so full playback + seeking are
 * impossible. We mint a session-bound WebPO token (bgutils-js + a throwaway
 * jsdom for the BotGuard VM) and hand it to youtubei.js, which appends `&pot=`
 * to the stream URLs — googlevideo then serves arbitrary ranges. The token is
 * bound to the session's visitor_data and minted once per process.
 */
const globalForInnertube = global as unknown as {
  innertube: Innertube | undefined;
  innertubeExpiry: number | undefined;
};

// Re-mint the PO token periodically (its integrity token expires in hours). On
// a long-running server a stale token starts 403'ing, so rebuild proactively.
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
 * Mint a session-bound WebPO token for the given visitor_data. Sets up a
 * throwaway jsdom for the BotGuard VM and tears the globals down afterwards so
 * the rest of the Node server isn't fooled into thinking it's a browser.
 */
async function generateWebPoToken(visitorData: string): Promise<string> {
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

let initializationPromise: Promise<Innertube | undefined> | null = null;

export async function getInnertube() {
  if (globalForInnertube.innertube && Date.now() < (globalForInnertube.innertubeExpiry ?? 0)) {
    return globalForInnertube.innertube;
  }
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    console.log('[InnerTube] Initializing session...');
    try {
      // 1. Throwaway session to obtain visitor_data for the token binding.
      const seed = await Innertube.create({ retrieve_player: false });
      const visitorData: string | undefined = seed.session.context.client.visitorData;

      // 2. Mint the WebPO token (best-effort — fall back to a tokenless session).
      let poToken: string | undefined;
      if (visitorData) {
        try {
          poToken = await generateWebPoToken(visitorData);
          console.log('[InnerTube] WebPO token minted.');
        } catch (err) {
          console.error('[InnerTube] PO token generation failed (playback may be limited):', err);
        }
      }

      // 3. Real session, with the token bound to the same visitor_data.
      globalForInnertube.innertube = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
        ...(poToken && visitorData ? { po_token: poToken, visitor_data: visitorData } : {}),
      });

      globalForInnertube.innertubeExpiry = Date.now() + SESSION_TTL_MS;
      console.log('[InnerTube] Session initialized successfully.');
    } catch (error) {
      console.error('[InnerTube] Failed to initialize InnerTube session:', error);
    } finally {
      initializationPromise = null;
    }
    return globalForInnertube.innertube;
  })();

  return initializationPromise;
}

/** Drop the cached session so the next call re-mints the PO token. */
export function resetInnertube() {
  globalForInnertube.innertube = undefined;
  globalForInnertube.innertubeExpiry = undefined;
  initializationPromise = null;
}
