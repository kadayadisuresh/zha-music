/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';
import { mapArtistDetails } from '@/lib/api/mappers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 });
  }

  try {
    const yt = await getInnertube();
    const artist = await yt.music.getArtist(id);
    
    const mapped = mapArtistDetails(artist);

    return NextResponse.json(mapped);
  } catch (error) {
    console.error(`[Browse Artist API] Error for ${id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch artist details' }, { status: 500 });
  }
}
