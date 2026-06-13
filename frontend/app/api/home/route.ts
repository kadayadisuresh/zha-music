import { NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';
import { mapTrack, mapAlbum } from '@/lib/api/mappers';

export async function GET() {
  try {
    const yt = await getInnertube();
    
    // Fallback to searching for trending music
    const results = await yt.music.search('trending', { type: 'song' });
    
    // Filter and map results
    const tracks = (results.songs?.contents || []).map(mapTrack).slice(0, 20);

    const sections = [
      {
        title: 'Trending Music',
        items: tracks
      }
    ];

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('[Home API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch home feed' }, { status: 500 });
  }
}
