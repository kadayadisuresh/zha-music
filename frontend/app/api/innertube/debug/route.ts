/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';
import { getStreamingInnertube } from '@/lib/innertube/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function probe(yt: any, videoId: string, clients: string[]) {
  const r: Record<string, any> = { signedIn: !!yt?.session?.logged_in };
  for (const client of clients) {
    try {
      const info: any = await yt.getInfo(videoId, { client });
      r[client] = {
        play: info?.playability_status?.status,
        sd: !!info?.streaming_data,
        fmts: info?.streaming_data?.adaptive_formats?.length || 0,
      };
    } catch (e: any) {
      r[client] = { err: e?.message || String(e) };
    }
  }
  return r;
}

// TEMP: compare cookie session configs to see which (if any) yields streaming
// data from this IP. Delete once resolved.
export async function GET(req: NextRequest) {
  const videoId = new URL(req.url).searchParams.get('video_id') || 'J7p4bzqLvCw';
  const cookie = process.env.YOUTUBE_COOKIE?.trim() || undefined;
  const out: Record<string, any> = { videoId, cookieLen: (cookie || '').length };

  // Config A — cookie only (clean authenticated session, no manual PO token).
  try {
    const ytA = await Innertube.create({ cookie, cache: new UniversalCache(false), retrieve_player: true });
    out.cookieOnly = await probe(ytA, videoId, ['WEB', 'TV_SIMPLY', 'WEB_EMBEDDED']);
  } catch (e: any) {
    out.cookieOnly = { err: e?.message || String(e) };
  }

  // Config B — current getStreamingInnertube (cookie + visitor-bound PO token).
  try {
    const ytB: any = await getStreamingInnertube();
    out.current = await probe(ytB, videoId, ['WEB', 'TV_SIMPLY']);
    out.current.hasPoToken = !!ytB?.session?.po_token;
  } catch (e: any) {
    out.current = { err: e?.message || String(e) };
  }

  return NextResponse.json(out);
}
