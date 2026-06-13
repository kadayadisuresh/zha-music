import { Innertube, UniversalCache, Platform } from 'youtubei.js';

/**
 * Global variable to hold the InnerTube instance.
 * 
 * PO Token generation is permanently disabled because:
 * 1. youtube-po-token-generator uses jsdom internally, consuming 4GB+ RAM and causing OOM crashes
 * 2. The vendor/index.html file is missing from the package
 * 3. InnerTube works for browsing, search, and streaming without PO tokens
 */
const globalForInnertube = global as unknown as {
  innertube: Innertube | undefined;
};

/**
 * Set the JavaScript evaluator for youtubei.js BEFORE creating the Innertube instance.
 * This is required for deciphering stream URLs (signature + n-parameter).
 * Uses the Function constructor which works in Node.js server-side environments.
 * See: https://ytjs.dev/guide/getting-started.html#providing-a-custom-javascript-interpreter
 */
Platform.shim.eval = async (data: { output: string }, env?: Record<string, unknown>) => {
  const keys = Object.keys(env || {});
  const values = Object.values(env || {});
  const fn = new Function(...keys, data.output);
  return fn(...values);
};

let initializationPromise: Promise<Innertube | undefined> | null = null;

export async function getInnertube() {
  if (globalForInnertube.innertube) return globalForInnertube.innertube;
  
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    console.log('[InnerTube] Initializing session...');
    
    try {
      globalForInnertube.innertube = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });

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
