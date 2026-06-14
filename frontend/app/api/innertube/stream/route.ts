import { NextRequest, NextResponse } from 'next/server';
import { resolveAudioStream } from '@/lib/innertube/resolveAudio';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId') || searchParams.get('video_id');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  // Basic validation to prevent abuse
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid videoId format' }, { status: 400 });
  }

  try {
    // Single resolver (Slice 4 — youtubei.js only, no FastAPI/yt-dlp fallback).
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
