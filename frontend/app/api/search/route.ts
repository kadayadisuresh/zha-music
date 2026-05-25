/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';
import { mapTrack, mapAlbum, mapSearchArtist } from '@/lib/api/mappers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const yt = await getInnertube();
    const results = await yt.music.search(query);

    // Initial categorization using youtubei.js getters
    const songs = (results.songs?.contents || []).map(mapTrack);
    const albums = (results.albums?.contents || []).map(mapAlbum);
    const artists = (results.artists?.contents || []).map(mapSearchArtist);

    // Fallback: If any category is empty, or to find items in other shelves (like Top Result / MusicCardShelf)
    // iterate through all contents.
    const allItems: any[] = [];
    const sourceContents = results.sections || (results as any).contents || [];
    
    sourceContents.forEach((section: any) => {
      if (section.contents) {
        section.contents.forEach((item: any) => {
          if (item.type === 'MusicResponsiveListItem') {
            allItems.push(item);
          } else if (item.type === 'MusicCardShelf') {
            // Top result card often contains a MusicResponsiveListItem
            if (item.contents) {
              item.contents.forEach((c: any) => {
                if (c.type === 'MusicResponsiveListItem') allItems.push(c);
              });
            }
          }
        });
      } else if (section.type === 'MusicShelf' || section.type === 'MusicCardShelf') {
        if (section.contents) {
          section.contents.forEach((item: any) => {
             if (item.type === 'MusicResponsiveListItem') allItems.push(item);
          });
        }
      }
    });

    // If we have items from allItems that aren't already in our lists, add them
    const seenIds = new Set([...songs, ...albums, ...artists].map(i => i.id));

    allItems.forEach(item => {
      if (seenIds.has(item.id)) return;
      
      if (item.item_type === 'song' || item.item_type === 'video') {
        songs.push(mapTrack(item));
        seenIds.add(item.id);
      } else if (item.item_type === 'album') {
        albums.push(mapAlbum(item));
        seenIds.add(item.id);
      } else if (item.item_type === 'artist') {
        artists.push(mapSearchArtist(item));
        seenIds.add(item.id);
      }
    });

    console.log(`[Search API] Found ${songs.length} songs, ${albums.length} albums, ${artists.length} artists`);

    return NextResponse.json({
      songs,
      albums,
      artists,
    });
  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results' }, { status: 500 });
  }
}
