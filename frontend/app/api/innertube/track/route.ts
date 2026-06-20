import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('video_id') || searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  // Hybrid resolver: from a datacenter IP (Vercel) YouTube returns no usable
  // metadata for some videos — especially ones not in the YouTube Music catalog,
  // which come back as "Unknown Title". When RESOLVER_URL points at a home /
  // residential instance, forward the lookup there so it resolves on a real IP
  // (same pattern as the audio pipe route). Best-effort: fall through to local
  // resolution if the resolver is unset or unreachable.
  const resolverUrl = process.env.RESOLVER_URL?.trim();
  if (resolverUrl) {
    try {
      const target = `${resolverUrl.replace(/\/+$/, '')}/api/innertube/track?video_id=${encodeURIComponent(videoId)}`;
      const token = process.env.RESOLVER_TOKEN?.trim();
      const upstream = await fetch(target, {
        headers: token ? { 'X-Resolver-Token': token } : {},
        signal: AbortSignal.timeout(30000),
      });
      if (upstream.ok) {
        return NextResponse.json(await upstream.json());
      }
    } catch (err: unknown) {
      console.error('[Track API] Resolver forward failed:', err instanceof Error ? err.message : err);
    }
  }

  try {
    const innertube = await getInnertube();
    if (!innertube) {
      return NextResponse.json({ error: 'Failed to initialize session' }, { status: 500 });
    }
    // Fetch video info using youtubei.js
    const info = await innertube.music.getInfo(videoId);
    const basic = info.basic_info;

    if (!basic) {
      return NextResponse.json({ error: 'No video info found' }, { status: 404 });
    }

    // Sort thumbnails to get the highest resolution
    const thumbnail = basic.thumbnail && basic.thumbnail.length > 0
      ? [...basic.thumbnail].sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0]?.url
      : undefined;

    return NextResponse.json({
      id: basic.id || videoId,
      title: basic.title || 'Unknown Title',
      artists: [{ name: basic.author || 'Unknown Artist' }],
      duration: basic.duration || 0,
      thumbnail: thumbnail,
    });
  } catch (error: any) {
    console.error('[Track API] Error fetching track info:', error);
    return NextResponse.json({ error: 'Failed to fetch track info' }, { status: 500 });
  }
}
