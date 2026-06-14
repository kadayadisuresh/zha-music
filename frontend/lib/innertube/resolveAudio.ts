import { getStreamingInnertube } from './session';

export type StreamClient = 'IOS' | 'ANDROID' | 'TV' | 'TV_SIMPLY' | 'WEB' | 'MWEB' | 'YTMUSIC';

// TV_SIMPLY (TVHTML5_SIMPLY) is the client that returns a direct, decipherable
// audio URL which — with the session WebPO token (see session.ts) appended as
// `&pot=` — serves arbitrary byte ranges from googlevideo (verified: mid-file
// fetch returns 200 with the requested bytes). WEB/TV use SABR (no direct URL);
// IOS/MWEB give URLs that 403 at non-zero offsets. IOS is kept only as a
// last-ditch fallback (plays the first chunk if TV_SIMPLY ever fails).
export const STREAM_CLIENTS: StreamClient[] = ['TV_SIMPLY', 'IOS'];

export interface ResolvedAudio {
  url: string;
  mimeType: string;
  contentLength: number;
  bitrate: number;
}

/**
 * Resolve a direct audio CDN URL for a video using youtubei.js with a specific
 * InnerTube client (Phase 17 · Slice 4 — replaces the FastAPI yt-dlp resolver).
 * Runs in a Next.js Node route handler, so it works on Vercel with no Python.
 */
export async function resolveAudioStream(
  videoId: string,
  client: StreamClient = 'TV_SIMPLY'
): Promise<ResolvedAudio> {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new Error('Invalid videoId format');
  }

  const innertube = await getStreamingInnertube();
  if (!innertube) throw new Error('InnerTube not initialized');

  const info = await innertube.getInfo(videoId, { client });
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  if (!format) throw new Error('No suitable audio format found');

  const url = await format.decipher(innertube.session.player);
  if (!url) throw new Error('Failed to decipher stream URL');

  return {
    url,
    mimeType: format.mime_type || 'audio/webm',
    contentLength: format.content_length || 0,
    bitrate: format.bitrate || 128000,
  };
}
