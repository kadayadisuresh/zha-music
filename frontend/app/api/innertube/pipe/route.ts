import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Cache resolved URLs for 5 minutes to avoid repeated backend round-trips.
const urlCache = new Map<string, { url: string; mimeType: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function resolveStreamUrl(videoId: string): Promise<{ url: string; mimeType: string }> {
  // Check cache first
  const cached = urlCache.get(videoId);
  if (cached && cached.expires > Date.now()) {
    return { url: cached.url, mimeType: cached.mimeType };
  }

  // Resolve via the FastAPI backend, which keeps yt-dlp imported in-process
  // (no Python subprocess cold-start) and caches results itself.
  try {
    const r = await fetch(`${BACKEND_URL}/audio/resolve/${videoId}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`backend resolve ${r.status}`);
    const result = await r.json();
    if (!result.url) throw new Error('backend returned no URL');

    const mimeType: string = result.mime_type || 'audio/webm';

    urlCache.set(videoId, { url: result.url, mimeType, expires: Date.now() + CACHE_TTL });
    if (urlCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of urlCache) {
        if (value.expires < now) urlCache.delete(key);
      }
    }

    return { url: result.url, mimeType };
  } catch (error: any) {
    console.error(`[Pipe API] resolution failed:`, error?.message || error);
    throw new Error('Failed to resolve stream URL');
  }
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

  try {
    const { url: streamUrl, mimeType } = await resolveStreamUrl(videoId);

    // Forward Range header from client for seeking support
    const rangeHeader = req.headers.get('range');
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const upstream = await fetch(streamUrl, {
      headers: fetchHeaders,
      signal: AbortSignal.timeout(600000), // 10 minutes for slow or throttled downloads
    });

    if (!upstream.ok && upstream.status !== 206) {
      // URL might have expired, clear cache and retry once
      urlCache.delete(videoId);
      const retryResult = await resolveStreamUrl(videoId);
      const retryUpstream = await fetch(retryResult.url, {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(600000),
      });

      if (!retryUpstream.ok && retryUpstream.status !== 206) {
        throw new Error(`Upstream fetch failed after retry: ${retryUpstream.status}`);
      }

      return buildStreamResponse(retryUpstream, retryResult.mimeType);
    }

    return buildStreamResponse(upstream, mimeType);
  } catch (error: any) {
    console.error('[Pipe API] Error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 });
  }
}

function buildStreamResponse(upstream: Response, mimeType: string): NextResponse {
  if (!upstream.body) {
    return NextResponse.json({ error: 'No body in upstream response' }, { status: 500 });
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  };

  const upstreamContentLength = upstream.headers.get('content-length');
  if (upstreamContentLength) {
    responseHeaders['Content-Length'] = upstreamContentLength;
  }

  const contentRange = upstream.headers.get('content-range');
  if (contentRange) {
    responseHeaders['Content-Range'] = contentRange;
  }

  const status = upstream.status === 206 ? 206 : 200;

  console.log(`[Pipe API] Streaming (${mimeType}, status: ${status})`);

  return new NextResponse(upstream.body as ReadableStream, {
    status,
    headers: responseHeaders,
  });
}
