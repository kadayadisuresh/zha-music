/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { debugMintToken, getStreamingInnertube } from '@/lib/innertube/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// TEMP (Vercel streaming diagnosis): does jsdom/bgutils load on Vercel, does the
// PO token mint, and does stream resolution succeed? Delete once fixed.
export async function GET(req: NextRequest) {
  const videoId = new URL(req.url).searchParams.get('video_id') || 'NEX1CbRXnic';
  const out: Record<string, any> = { videoId };

  try {
    const { JSDOM } = await import('jsdom');
    new JSDOM('<!DOCTYPE html><body><p>x</p></body>');
    out.jsdom = 'ok';
  } catch (e: any) {
    out.jsdom = 'FAIL: ' + (e?.message || String(e));
    out.jsdomStack = String(e?.stack || '').split('\n').slice(0, 5);
  }

  try {
    const bg: any = await import('bgutils-js');
    out.bgutils = bg?.BG ? 'ok' : 'loaded-no-BG';
  } catch (e: any) {
    out.bgutils = 'FAIL: ' + (e?.message || String(e));
  }

  // The actual end-to-end PO-token mint (BotGuard challenge → integrity → mint).
  out.mint = await debugMintToken();

  // Inspect getInfo per client on the token-bound session: playability + whether
  // YouTube actually returned streaming formats (vs flagging the datacenter IP).
  try {
    const yt: any = await getStreamingInnertube();
    out.sessionHasToken = !!yt?.session?.po_token;
    for (const client of ['TV_SIMPLY', 'WEB', 'IOS', 'MWEB', 'ANDROID'] as const) {
      try {
        const info: any = await yt.getInfo(videoId, { client });
        out['client_' + client] = {
          playability: info?.playability_status?.status,
          reason: info?.playability_status?.reason || info?.playability_status?.error_screen?.reason?.text,
          hasStreamingData: !!info?.streaming_data,
          adaptiveFormats: info?.streaming_data?.adaptive_formats?.length || 0,
          title: info?.basic_info?.title,
        };
      } catch (e: any) {
        out['client_' + client] = { err: e?.message || String(e) };
      }
    }
  } catch (e: any) {
    out.streamingSession = 'FAIL: ' + (e?.message || String(e));
  }

  return NextResponse.json(out);
}
