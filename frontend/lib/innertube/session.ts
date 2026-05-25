import { Innertube, UniversalCache } from 'youtubei.js';
// @ts-ignore
import { generate } from 'youtube-po-token-generator';

/**
 * Global variable to hold the InnerTube instance and refresh interval
 * to ensure a singleton across HMR during development.
 */
const globalForInnertube = global as unknown as {
  innertube: Innertube | undefined;
  refreshInterval: NodeJS.Timeout | undefined;
};

async function refreshPoToken(innertube: Innertube) {
  try {
    console.log('[InnerTube] Refreshing PO Token...');
    const { visitorData, poToken } = await generate();
    
    // Update the session credentials
    innertube.session.context.client.visitorData = visitorData;
    (innertube.session as any).po_token = poToken;
    
    console.log('[InnerTube] PO Token refreshed successfully.');
  } catch (error) {
    console.error('[InnerTube] Failed to refresh PO Token:', error);
  }
}

export async function getInnertube() {
  if (!globalForInnertube.innertube) {
    console.log('[InnerTube] Initializing new session with PO Token...');
    
    try {
      const { visitorData, poToken } = await generate();
      
      globalForInnertube.innertube = await Innertube.create({
        visitor_data: visitorData,
        po_token: poToken,
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });

      // Start background refresh every 6 hours (PO tokens usually last 24h)
      if (!globalForInnertube.refreshInterval) {
        globalForInnertube.refreshInterval = setInterval(() => {
          if (globalForInnertube.innertube) {
            refreshPoToken(globalForInnertube.innertube);
          }
        }, 6 * 60 * 60 * 1000);
      }

      console.log('[InnerTube] Session initialized.');
    } catch (error) {
      console.error('[InnerTube] Failed to initialize InnerTube session:', error);
      // Fallback to basic initialization if PO token generation fails
      globalForInnertube.innertube = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
    }
  }
  return globalForInnertube.innertube;
}
