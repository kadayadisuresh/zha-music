import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';
import { mapAlbumDetails } from '@/lib/api/mappers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
  }

  try {
    const yt = await getInnertube();
    const album = await yt.music.getAlbum(id);
    
    const mapped = mapAlbumDetails(album);

    return NextResponse.json(mapped);
  } catch (error) {
    console.error(`[Browse Album API] Error for ${id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch album details' }, { status: 500 });
  }
}
