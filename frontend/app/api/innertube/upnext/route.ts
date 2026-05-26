import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  try {
    const innertube = await getInnertube();
    // getUpNext is a method of InnerTube class in youtubei.js
    const upNext = await innertube.getUpNext(videoId);

    // youtubei.js returns a list of items in the 'contents' or similar fields
    // We map them to our internal Track format.
    const tracks = upNext.contents?.filter((item: any) => item.type === 'CompactVideo' || item.type === 'Video').map((item: any) => {
      return {
        id: item.id,
        title: item.title?.toString() || 'Unknown Title',
        artists: item.author ? [{ name: item.author.name, id: item.author.id }] : [],
        thumbnail: item.thumbnails?.[0]?.url,
        duration: item.duration?.seconds,
      };
    }).filter((t: any) => t.id) || [];

    return NextResponse.json(tracks);
  } catch (error: any) {
    console.error('[UpNext API] Error fetching suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
