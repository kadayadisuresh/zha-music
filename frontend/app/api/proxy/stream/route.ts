import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight stream proxy that fetches from a pre-resolved CDN URL
 * and streams it to the client. This avoids CORS issues when the browser
 * tries to fetch directly from googlevideo.com CDN.
 *
 * The key difference from the backend proxy: here the CDN URL is already
 * resolved (no yt-dlp call needed), so this is just a simple pipe — much
 * faster than the backend proxy which re-resolves the URL every time.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cdnUrl = searchParams.get('url');

  if (!cdnUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Only allow googlevideo.com URLs to prevent open proxy abuse
  try {
    const parsed = new URL(cdnUrl);
    if (!parsed.hostname.endsWith('.googlevideo.com')) {
      return NextResponse.json({ error: 'Invalid URL domain' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const upstream = await fetch(cdnUrl);

    if (!upstream.ok) {
      return new NextResponse(`CDN returned ${upstream.status}`, { status: upstream.status });
    }

    // Forward the response body as a stream
    const headers = new Headers();
    const contentType = upstream.headers.get('Content-Type');
    const contentLength = upstream.headers.get('Content-Length');

    if (contentType) headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    headers.set('Accept-Ranges', 'none');
    headers.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error('[Stream Proxy] Error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to proxy stream' }, { status: 502 });
  }
}
