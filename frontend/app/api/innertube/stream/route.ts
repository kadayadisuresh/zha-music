import { NextRequest, NextResponse } from 'next/server';
import { resolveAudioStream } from '@/lib/innertube/resolveAudio';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId') || searchParams.get('video_id');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid videoId format' }, { status: 400 });
  }

  // Resolve-only home resolver: YouTube blocks resolution (getInfo) from
  // datacenter IPs (Vercel), so when RESOLVER_URL points at a home/residential-IP
  // instance of this app, forward ONLY the resolve request there and relay the
  // JSON (just the CDN URL). The audio bytes never touch any server — the browser
  // plays the returned googlevideo URL directly. Set RESOLVER_URL only on the
  // hosted (Vercel) deployment, never on the home resolver itself.
  const resolverUrl = process.env.RESOLVER_URL?.trim();
  if (resolverUrl) {
    try {
      const headers: Record<string, string> = {};
      const token = process.env.RESOLVER_TOKEN?.trim();
      if (token) headers['X-Resolver-Token'] = token;
      const target = `${resolverUrl.replace(/\/+$/, '')}/api/innertube/stream?videoId=${videoId}`;
      const upstream = await fetch(target, { headers, signal: AbortSignal.timeout(30000) });
      const body = await upstream.text();
      return new NextResponse(body, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      console.error('[Stream API] Resolver forward failed:', error?.message || error);
      return NextResponse.json({ error: 'Resolver unreachable' }, { status: 502 });
    }
  }

  // Home resolver: if a shared secret is configured, only serve requests carrying it.
  const resolverToken = process.env.RESOLVER_TOKEN?.trim();
  if (resolverToken && req.headers.get('x-resolver-token') !== resolverToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const resolved = await resolveAudioStream(videoId);
    console.log(`[Stream API] Resolved direct stream URL for ${videoId} (${resolved.mimeType}, ${resolved.bitrate}bps)`);
    return NextResponse.json({
      url: resolved.url,
      content_length: resolved.contentLength,
      expires: Date.now() + 6 * 60 * 60 * 1000,
      format: {
        mime_type: resolved.mimeType,
        bitrate: resolved.bitrate,
        audio_channels: 2,
      },
    });
  } catch (error: any) {
    console.error('[Stream API] Error fetching stream:', error?.message || error);
    if (error?.status === 403 || error?.status === 404) {
      return NextResponse.json({ error: error.message || 'Access denied' }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to fetch stream' }, { status: 500 });
  }
}
