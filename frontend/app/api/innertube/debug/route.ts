/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { resolveAudioStream } from '@/lib/innertube/resolveAudio';
import { getStreamingInnertube } from '@/lib/innertube/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// TEMP (live streaming diagnosis): is the cookie applied, does YouTube return
// streaming data, and where does resolution fail? Delete once fixed.
export async function GET(req: NextRequest) {
  const videoId = new URL(req.url).searchParams.get('video_id') || 'J7p4bzqLvCw';
  const cookie = process.env.YOUTUBE_COOKIE || '';
  const out: Record<string, any> = {
    videoId,
    cookie: { set: !!cookie, len: cookie.length, sample: cookie.slice(0, 18) },
  };

  try {
    const yt: any = await getStreamingInnertube();
    out.session = {
      hasPoToken: !!yt?.session?.po_token,
      isSignedIn: !!yt?.session?.logged_in,
      visitorData: (yt?.session?.context?.client?.visitorData || '').slice(0, 14),
    };
    for (const client of ['TV_SIMPLY', 'WEB', 'IOS'] as const) {
      try {
        const info: any = await yt.getInfo(videoId, { client });
        out['client_' + client] = {
          playability: info?.playability_status?.status,
          reason: info?.playability_status?.reason,
          hasStreamingData: !!info?.streaming_data,
          adaptiveFormats: info?.streaming_data?.adaptive_formats?.length || 0,
        };
      } catch (e: any) {
        out['client_' + client] = { err: e?.message || String(e) };
      }
    }
  } catch (e: any) {
    out.sessionErr = e?.message || String(e);
  }

  for (const client of ['TV_SIMPLY', 'IOS'] as const) {
    try {
      const r = await resolveAudioStream(videoId, client);
      out['resolve_' + client] = { ok: true, hasPot: /[?&]pot=/.test(r.url), len: r.contentLength };
    } catch (e: any) {
      out['resolve_' + client] = { ok: false, err: e?.message || String(e) };
    }
  }

  return NextResponse.json(out);
}
