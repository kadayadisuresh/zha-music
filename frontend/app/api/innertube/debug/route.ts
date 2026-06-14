/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { resolveAudioStream } from '@/lib/innertube/resolveAudio';

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

  for (const client of ['TV_SIMPLY', 'IOS'] as const) {
    try {
      const r = await resolveAudioStream(videoId, client);
      out[client] = { ok: true, hasPot: /[?&]pot=/.test(r.url), contentLength: r.contentLength, mime: r.mimeType };
    } catch (e: any) {
      out[client] = { ok: false, err: e?.message || String(e) };
    }
  }

  return NextResponse.json(out);
}
