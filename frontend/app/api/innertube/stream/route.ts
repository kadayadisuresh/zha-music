import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';

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
    const innertube = await getInnertube();
    if (!innertube) {
      throw new Error('InnerTube not initialized');
    }

    // Get video info from YouTube Music
    const info = await innertube.music.getInfo(videoId);
    
    // Get best audio-only format
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    
    if (!format) {
      return NextResponse.json({ error: 'No suitable audio format found' }, { status: 404 });
    }

    // Get the deciphered stream URL directly from youtubei.js
    const streamUrl = await format.decipher(innertube.session.player);

    if (!streamUrl) {
      throw new Error('Failed to decipher stream URL');
    }

    console.log(`[Stream API] Resolved direct stream URL for ${videoId} (${format.mime_type}, ${format.bitrate}bps)`);
    
    return NextResponse.json({
      url: streamUrl,
      content_length: format.content_length || 0,
      expires: Date.now() + 6 * 60 * 60 * 1000,
      format: {
        mime_type: format.mime_type || 'audio/webm',
        bitrate: format.bitrate || 128000,
        audio_channels: format.audio_channels || 2,
      }
    });
  } catch (error: any) {
    console.error('[Stream API] Error fetching stream:', error?.message || error);
    
    // Fallback: use backend /audio/resolve/ to get direct CDN URL (not the proxy)
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
      const resolveRes = await fetch(`${baseUrl}/audio/resolve/${videoId}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (resolveRes.ok) {
        const data = await resolveRes.json();
        console.log(`[Stream API] Falling back to backend resolve for ${videoId}`);
        return NextResponse.json({
          url: data.url,
          content_length: data.content_length || 0,
          expires: Date.now() + 6 * 60 * 60 * 1000,
          format: {
            mime_type: data.mime_type || 'audio/webm',
            bitrate: 128000,
            audio_channels: 2,
          }
        });
      }
    } catch {
      // Backend resolve failed, try proxy as last resort
    }

    // Last resort: return the proxy URL
    try {
      const probeRes = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(2000) });
      if (probeRes.ok) {
        console.log(`[Stream API] Last resort: backend proxy for ${videoId}`);
        return NextResponse.json({
          url: `${baseUrl}/audio/proxy/${videoId}`,
          content_length: 0,
          expires: Date.now() + 6 * 60 * 60 * 1000,
          format: {
            mime_type: 'audio/webm',
            bitrate: 128000,
            audio_channels: 2,
          }
        });
      }
    } catch {
      // Backend not available
    }

    // Handle YouTube specific errors (like private videos, age restriction)
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json({ error: error.message || 'Access denied' }, { status: error.status });
    }
    
    return NextResponse.json({ error: 'Failed to fetch stream' }, { status: 500 });
  }
}
