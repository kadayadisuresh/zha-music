import { NextRequest, NextResponse } from 'next/server';
import { resolveAudioStream, STREAM_CLIENTS } from '@/lib/innertube/resolveAudio';
import { resetInnertube } from '@/lib/innertube/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Resolved { url: string; mimeType: string; contentLength: number }

// Cache the working URL per video for 5 minutes; the audio element makes many
// range requests per track, and they must all reuse one resolved URL.
const urlCache = new Map<string, Resolved & { expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Single-flight: dedupe concurrent resolutions for the same video. Two
// simultaneous youtubei.js resolutions for one video race through the shared
// session and both get 403'd by googlevideo — sharing one resolution fixes it.
const inflight = new Map<string, Promise<Resolved>>();

// A desktop UA keeps googlevideo from rejecting the proxied byte fetch.
const UPSTREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// googlevideo rejects HTTP Range at non-zero offsets and 403s large/open
// fetches on these (no-PO-token) URLs. The reliable, seekable way — what yt-dlp
// does — is to request a bounded chunk via the `&range=START-END` query param
// and synthesize the 206 Content-Range from the format's total size.
const CHUNK_SIZE = 1_048_576; // 1 MiB

function parseStart(header: string | null): number {
  const m = header && /bytes=(\d+)-/.exec(header);
  return m ? parseInt(m[1], 10) : 0;
}

function pruneCache() {
  if (urlCache.size <= 100) return;
  const now = Date.now();
  for (const [key, value] of urlCache) {
    if (value.expires < now) urlCache.delete(key);
  }
}

function upstreamFetch(url: string, start: number, end: number): Promise<Response> {
  const u = new URL(url);
  u.searchParams.set('range', `${start}-${end}`);
  return fetch(u.toString(), {
    headers: { 'User-Agent': UPSTREAM_UA },
    signal: AbortSignal.timeout(600000),
  });
}

/** Resolve (and cache) a working CDN URL, deduping concurrent callers. */
function resolveWorkingUrl(videoId: string, forceFresh: boolean): Promise<Resolved> {
  if (!forceFresh) {
    const cached = urlCache.get(videoId);
    if (cached && cached.expires > Date.now()) {
      return Promise.resolve({ url: cached.url, mimeType: cached.mimeType, contentLength: cached.contentLength });
    }
    const pending = inflight.get(videoId);
    if (pending) return pending;
  } else {
    urlCache.delete(videoId);
  }

  const job = (async () => {
    let lastErr: unknown;
    for (const client of STREAM_CLIENTS) {
      try {
        const r = await resolveAudioStream(videoId, client);
        const resolved: Resolved = { url: r.url, mimeType: r.mimeType, contentLength: r.contentLength };
        urlCache.set(videoId, { ...resolved, expires: Date.now() + CACHE_TTL });
        pruneCache();
        return resolved;
      } catch (err) {
        lastErr = err;
        console.warn(`[Pipe API] ${videoId} resolve via ${client} failed:`, (err as Error)?.message || err);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Failed to resolve stream URL');
  })();

  inflight.set(videoId, job);
  return job.finally(() => inflight.delete(videoId));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId') || searchParams.get('video_id');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid videoId format' }, { status: 400 });
  }

  const forceFresh = !!searchParams.get('refresh');
  const rangeHeader = req.headers.get('range');

  // No Range header → a full-file download (the offline-download worker). Stream
  // the whole file by chaining bounded chunks, since one large fetch is 403'd.
  if (!rangeHeader) {
    try {
      const resolved = await resolveWorkingUrl(videoId, forceFresh);
      const headers: Record<string, string> = {
        'Content-Type': resolved.mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      };
      if (resolved.contentLength) headers['Content-Length'] = String(resolved.contentLength);
      return new NextResponse(fullFileStream(resolved.url, resolved.contentLength), { status: 200, headers });
    } catch (error: any) {
      console.error('[Pipe API] Error (full):', error?.message || error);
      return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 });
    }
  }

  const start = parseStart(rangeHeader);

  try {
    let resolved = await resolveWorkingUrl(videoId, forceFresh);
    const total = resolved.contentLength;

    // Range past EOF — answer 416 rather than letting googlevideo 400.
    if (total && start >= total) {
      return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    }
    const end = total ? Math.min(start + CHUNK_SIZE - 1, total - 1) : start + CHUNK_SIZE - 1;

    let upstream = await upstreamFetch(resolved.url, start, end);
    if (!upstream.ok && upstream.status !== 206) {
      try { await upstream.body?.cancel(); } catch {}
      resolved = await resolveWorkingUrl(videoId, true); // URL may have expired — re-resolve once
      upstream = await upstreamFetch(resolved.url, start, end);
      if (!upstream.ok && upstream.status !== 206) {
        // Most likely the session PO token went stale — drop it so the next
        // request re-mints a fresh one.
        resetInnertube();
        throw new Error(`Upstream fetch failed after retry: ${upstream.status}`);
      }
    }

    return buildChunkResponse(upstream, resolved.mimeType, start, end, total);
  } catch (error: any) {
    console.error('[Pipe API] Error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 });
  }
}

// Stream a whole file as one body by pulling bounded chunks on demand.
function fullFileStream(url: string, total: number): ReadableStream<Uint8Array> {
  let pos = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (total && pos >= total) { controller.close(); return; }
      const end = total ? Math.min(pos + CHUNK_SIZE - 1, total - 1) : pos + CHUNK_SIZE - 1;
      const resp = await upstreamFetch(url, pos, end);
      if (resp.status >= 400) { controller.error(new Error(`chunk fetch ${resp.status}`)); return; }
      const buf = new Uint8Array(await resp.arrayBuffer());
      if (buf.length === 0) { controller.close(); return; }
      controller.enqueue(buf);
      pos += buf.length;
      if (!total && buf.length < CHUNK_SIZE) controller.close(); // EOF when total unknown
    },
  });
}

// googlevideo's `&range=` responses come back as 200 without Content-Range, so
// rebuild a proper 206 partial response the <audio> element can seek against.
function buildChunkResponse(
  upstream: Response,
  mimeType: string,
  start: number,
  end: number,
  total: number
): NextResponse {
  if (!upstream.body) {
    return NextResponse.json({ error: 'No body in upstream response' }, { status: 500 });
  }

  const chunkLen = Number(upstream.headers.get('content-length')) || end - start + 1;
  const lastByte = total ? Math.min(start + chunkLen - 1, total - 1) : start + chunkLen - 1;

  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(chunkLen),
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  };
  if (total) headers['Content-Range'] = `bytes ${start}-${lastByte}/${total}`;

  return new NextResponse(upstream.body as ReadableStream, {
    status: total ? 206 : 200,
    headers,
  });
}
