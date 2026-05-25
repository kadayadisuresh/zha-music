import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  // Basic validation to prevent abuse (STRIDE T-02-01)
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid videoId format' }, { status: 400 });
  }

  try {
    const innertube = await getInnertube();
    const info = await innertube.getInfo(videoId);
    
    // Get best audio-only format
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    
    if (!format) {
      return NextResponse.json({ error: 'No suitable audio format found' }, { status: 404 });
    }

    // Return the stream URL
    const url = format.decipher(innertube.session.player);
    
    return NextResponse.json({
      url,
      expires: Date.now() + 6 * 60 * 60 * 1000,
      format: {
        mime_type: format.mime_type,
        bitrate: format.bitrate,
        audio_channels: format.audio_channels,
      }
    });
  } catch (error: any) {
    console.error('[Stream API] Error fetching stream:', error);
    
    // Handle YouTube specific errors (like private videos, age restriction)
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json({ error: error.message || 'Access denied' }, { status: error.status });
    }
    
    return NextResponse.json({ error: 'Failed to fetch stream' }, { status: 500 });
  }
}
