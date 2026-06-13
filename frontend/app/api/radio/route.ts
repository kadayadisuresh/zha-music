/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
  }

  try {
    const yt = await getInnertube();
    if (!yt) {
      throw new Error('InnerTube not initialized');
    }

    // Use getUpNext to fetch the "Up Next" / radio queue for a given video
    const upNext = await (yt.music as any).getUpNext(videoId);

    const tracks: any[] = [];

    // Extract playlist panel items from the up-next response
    const contents = upNext?.contents || upNext?.playlist_panel?.contents || [];

    for (const item of contents) {
      try {
        // PlaylistPanelVideo items
        const id = item.video_id || item.id;
        if (!id) continue;

        const title = item.title?.text || item.title || 'Unknown';

        // Parse artists from runs or direct fields
        let artists: { id?: string; name: string }[] = [];
        if (item.artists && Array.isArray(item.artists)) {
          artists = item.artists.map((a: any) => ({
            id: a.channel_id || a.id,
            name: a.name || a.text || String(a),
          }));
        } else if (item.short_byline?.text) {
          artists = [{ name: item.short_byline.text }];
        } else if (item.long_byline?.text) {
          artists = [{ name: item.long_byline.text }];
        }

        // Parse thumbnails
        let thumbnails: { url: string; width: number; height: number }[] = [];
        if (item.thumbnail?.contents) {
          thumbnails = item.thumbnail.contents.map((t: any) => ({
            url: t.url,
            width: t.width || 226,
            height: t.height || 226,
          }));
        } else if (item.thumbnail) {
          const thumbList = Array.isArray(item.thumbnail) ? item.thumbnail : [item.thumbnail];
          thumbnails = thumbList.map((t: any) => ({
            url: t.url || t,
            width: t.width || 226,
            height: t.height || 226,
          }));
        }

        tracks.push({
          videoId: id,
          title,
          artists,
          thumbnails,
        });
      } catch {
        // Skip malformed items
        continue;
      }
    }

    // If getUpNext didn't return results, fall back to a related search
    if (tracks.length === 0) {
      console.log('[Radio API] getUpNext returned no tracks, falling back to related search');
      try {
        const info = await yt.music.getInfo(videoId);
        const related = (info as any).related || (info as any).watch_next_feed || [];
        
        for (const item of related) {
          const id = item.video_id || item.id;
          if (!id) continue;
          
          tracks.push({
            videoId: id,
            title: item.title?.text || item.title || 'Unknown',
            artists: item.artists?.map((a: any) => ({ 
              id: a.channel_id || a.id, 
              name: a.name || String(a) 
            })) || [{ name: 'Unknown' }],
            thumbnails: item.thumbnail?.contents || item.thumbnails || [],
          });
        }
      } catch (fallbackErr) {
        console.warn('[Radio API] Related search fallback also failed:', fallbackErr);
      }
    }

    console.log(`[Radio API] Returning ${tracks.length} suggestions for ${videoId}`);

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('[Radio API] Error:', error);
    return NextResponse.json({ tracks: [] });
  }
}
