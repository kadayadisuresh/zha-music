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
    if (!yt) {
      throw new Error('InnerTube not initialized');
    }

    // 1. Fetch filtered categories in parallel to get high-fidelity metadata (including accurate durations for songs)
    const [songResults, albumResults, artistResults] = await Promise.all([
      yt.music.search(query, { type: 'song' }).catch(err => {
        console.warn('[Search API] Filtered song search failed:', err);
        return null;
      }),
      yt.music.search(query, { type: 'album' }).catch(err => {
        console.warn('[Search API] Filtered album search failed:', err);
        return null;
      }),
      yt.music.search(query, { type: 'artist' }).catch(err => {
        console.warn('[Search API] Filtered artist search failed:', err);
        return null;
      }),
    ]);

    // Helper to safely extract contents from filtered search results
    const extractContents = (results: any, expectedShelfTitle: string) => {
      if (!results) return [];
      
      // Try to find the expected shelf (e.g. Songs, Albums, Artists)
      if (results.contents) {
        // Shelf is usually the first item in contents array for filtered searches
        const shelf = results.contents.find((c: any) => 
          c.type === 'MusicShelf' || 
          (c.title?.text && c.title.text.toLowerCase() === expectedShelfTitle.toLowerCase())
        );
        if (shelf?.contents) return shelf.contents;
        
        // If no matching shelf, check if first item is a MusicShelf
        if (results.contents[0]?.contents) return results.contents[0].contents;
        
        // Fallback to raw contents if it's already a flat list
        return results.contents;
      }
      return [];
    };

    const songs = extractContents(songResults, 'Songs').map(mapTrack);
    const albums = extractContents(albumResults, 'Albums').map(mapAlbum);
    const artists = extractContents(artistResults, 'Artists').map(mapSearchArtist);

    // 2. Fallback: If any category is empty, perform a general mixed search to fill in items
    if (songs.length === 0 || albums.length === 0 || artists.length === 0) {
      console.log('[Search API] Performing mixed search fallback for missing categories...');
      try {
        const results = await yt.music.search(query);
        const seenIds = new Set([...songs, ...albums, ...artists].map(i => i.id));
        const allItems: any[] = [];
        const sourceContents = (results as any).sections || (results as any).contents || [];
        
        sourceContents.forEach((section: any) => {
          if (section.contents) {
            section.contents.forEach((item: any) => {
              if (item.type === 'MusicResponsiveListItem') {
                allItems.push(item);
              } else if (item.type === 'MusicCardShelf') {
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

        allItems.forEach(item => {
          if (seenIds.has(item.id || item.video_id)) return;
          
          if (item.item_type === 'song' || item.item_type === 'video') {
            songs.push(mapTrack(item));
            seenIds.add(item.id || item.video_id);
          } else if (item.item_type === 'album') {
            albums.push(mapAlbum(item));
            seenIds.add(item.id || item.browse_id);
          } else if (item.item_type === 'artist') {
            artists.push(mapSearchArtist(item));
            seenIds.add(item.id || item.browse_id);
          }
        });
      } catch (mixedErr) {
        console.warn('[Search API] Mixed search fallback failed:', mixedErr);
      }
    }

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
