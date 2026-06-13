/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

export const ThumbnailSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
});

export const ArtistSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
});

export const TrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artists: z.array(ArtistSchema),
  album: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  duration: z.number().optional(), // in seconds
  thumbnail: z.string().optional(),
});

export const AlbumSchema = z.object({
  id: z.string(),
  title: z.string(),
  artists: z.array(ArtistSchema),
  year: z.string().optional(),
  thumbnail: z.string().optional(),
});

export const SearchArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  thumbnail: z.string().optional(),
});

export const SearchResultSchema = z.object({
  songs: z.array(TrackSchema),
  albums: z.array(AlbumSchema),
  artists: z.array(SearchArtistSchema),
});

export const ArtistDetailsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  header_thumbnail: z.string().optional(),
  sections: z.array(z.object({
    title: z.string(),
    type: z.string(),
    items: z.array(z.any()),
  })),
});

export const AlbumDetailsSchema = z.object({
  id: z.string(),
  title: z.string(),
  artists: z.array(ArtistSchema),
  year: z.string().optional(),
  thumbnail: z.string().optional(),
  tracks: z.array(TrackSchema),
  description: z.string().optional(),
});

export type Thumbnail = z.infer<typeof ThumbnailSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Album = z.infer<typeof AlbumSchema>;
export type SearchArtist = z.infer<typeof SearchArtistSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type ArtistDetails = z.infer<typeof ArtistDetailsSchema>;
export type AlbumDetails = z.infer<typeof AlbumDetailsSchema>;

export function mapThumbnail(thumbnail: any): string | undefined {
  if (!thumbnail) return undefined;
  
  let thumbnails: any[] = [];
  if (Array.isArray(thumbnail)) {
    thumbnails = thumbnail;
  } else if (thumbnail.contents && Array.isArray(thumbnail.contents)) {
    thumbnails = thumbnail.contents;
  } else if (typeof thumbnail === 'object') {
    // If it's a single thumbnail object
    return thumbnail.url;
  }

  if (thumbnails.length === 0) return undefined;
  
  // Pick the highest resolution
  return [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url;
}

export function mapArtist(artist: any): Artist {
  return {
    id: artist.id || artist.browse_id,
    name: artist.name || artist.text || 'Unknown Artist',
  };
}

/**
 * Parse a duration text string (e.g., "4:22", "1:03:22") into seconds.
 */
function parseDurationText(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  // Clean the text - remove any non-numeric/colon characters
  const cleaned = text.trim().replace(/[^\d:]/g, '');
  if (!cleaned) return 0;
  
  const parts = cleaned.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  
  if (parts.length === 2) return parts[0] * 60 + parts[1];        // M:SS
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // H:MM:SS
  if (parts.length === 1) return parts[0]; // Just seconds
  return 0;
}

export function mapTrack(item: any): Track {
  const title = (typeof item.title === 'string' ? item.title : item.title?.text) || item.name || 'Unknown';
  
  // Comprehensive duration parsing — InnerTube returns duration in many formats
  let duration = 0;
  
  // 1. Direct seconds property (most common for song-type results)
  if (item.duration?.seconds && typeof item.duration.seconds === 'number') {
    duration = item.duration.seconds;
  }
  // 2. Duration is a plain number
  else if (typeof item.duration === 'number' && item.duration > 0) {
    duration = item.duration;
  }
  // 3. Duration has a text property (common for MusicResponsiveListItem)
  else if (item.duration?.text) {
    duration = parseDurationText(item.duration.text);
  }
  // 4. Duration is a plain string like "4:22"
  else if (typeof item.duration === 'string') {
    duration = parseDurationText(item.duration);
  }
  
  // 5. Fallback: check fixed_columns for duration (YTM search results sometimes put it here)
  if (duration === 0 && item.fixed_columns) {
    for (const col of item.fixed_columns) {
      const text = col?.title?.text || col?.text?.text || col?.text;
      if (typeof text === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(text.trim())) {
        duration = parseDurationText(text);
        if (duration > 0) break;
      }
      // Also check runs inside the column
      const runs = col?.title?.runs || col?.text?.runs;
      if (Array.isArray(runs)) {
        for (const run of runs) {
          if (typeof run.text === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(run.text.trim())) {
            duration = parseDurationText(run.text);
            if (duration > 0) break;
          }
        }
        if (duration > 0) break;
      }
    }
  }
  
  // 6. Fallback: check flex_columns for duration text
  if (duration === 0 && item.flex_columns) {
    for (const col of item.flex_columns) {
      const runs = col?.title?.runs || col?.text?.runs;
      if (Array.isArray(runs)) {
        for (const run of runs) {
          if (typeof run.text === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(run.text.trim())) {
            duration = parseDurationText(run.text);
            if (duration > 0) break;
          }
        }
        if (duration > 0) break;
      }
    }
  }

  // 7. Fallback: duration_text or length_text properties
  if (duration === 0) {
    const textFallback = item.duration_text?.text || item.duration_text 
      || item.length_text?.text || item.length_text
      || item.length?.text || item.length;
    if (typeof textFallback === 'string') {
      duration = parseDurationText(textFallback);
    } else if (typeof textFallback === 'number') {
      duration = textFallback;
    }
  }

  return {
    id: item.id || item.video_id,
    title,
    artists: (item.artists || item.authors || []).map(mapArtist),
    album: item.album ? { 
      id: item.album.id || item.album.browse_id, 
      name: (typeof item.album.name === 'string' ? item.album.name : item.album.text) 
    } : undefined,
    duration,
    thumbnail: mapThumbnail(item.thumbnail || item.thumbnails),
  };
}

export function mapAlbum(item: any): Album {
  const title = (typeof item.title === 'string' ? item.title : item.title?.text) || item.name || 'Unknown';
  return {
    id: item.id || item.browse_id,
    title,
    artists: (item.artists || item.authors || []).map(mapArtist),
    year: item.year?.text || item.year,
    thumbnail: mapThumbnail(item.thumbnail || item.thumbnails),
  };
}

export function mapSearchArtist(item: any): SearchArtist {
  const name = (typeof item.title === 'string' ? item.title : item.title?.text) || item.name || 'Unknown';
  return {
    id: item.id || item.browse_id,
    name,
    thumbnail: mapThumbnail(item.thumbnail || item.thumbnails),
  };
}

export function mapArtistDetails(artist: any): ArtistDetails {
  const sections = (artist.sections || []).map((section: any) => ({
    title: section.title?.text || section.type || 'Untitled',
    type: section.type || 'unknown',
    items: (section.contents || []).flatMap((item: any) => {
      // MusicResponsiveListItem — track/album/artist rows
      if (item.type === 'MusicResponsiveListItem') {
        if (item.item_type === 'song' || item.item_type === 'video') return [mapTrack(item)];
        if (item.item_type === 'album') return [mapAlbum(item)];
        if (item.item_type === 'artist') return [mapSearchArtist(item)];
        // Fallback: try to detect by available fields
        if (item.id && item.title) return [mapTrack(item)];
        return [];
      }

      // MusicTwoRowItem — appears in carousel sections (e.g., "Albums", "Singles")
      if (item.type === 'MusicTwoRowItem') {
        const title = typeof item.title === 'string'
          ? item.title
          : (item.title?.text || item.title?.runs?.[0]?.text || '');
        const id = item.id || item.browse_id
          || item.navigationEndpoint?.browseEndpoint?.browseId
          || item.title?.endpoint?.browseEndpoint?.browseId
          || '';
        if (!id) return [];
        return [{
          id,
          title,
          artists: (item.artists || item.subtitle?.runs
            ? parseSubtitleArtists(item.subtitle)
            : []
          ),
          year: typeof item.year === 'string'
            ? item.year
            : (item.year?.text || undefined),
          thumbnail: mapThumbnail(item.thumbnail || item.thumbnails),
        } as Album];
      }

      // MusicNavigationButton, Moods, etc. — skip silently
      return [];
    }),
  })).filter((s: any) => s.items.length > 0);

  return {
    id: artist.header?.id || '',
    name: artist.header?.name?.text || '',
    description: artist.header?.description?.text,
    thumbnail: mapThumbnail(artist.header?.thumbnail),
    header_thumbnail: mapThumbnail(artist.header?.header_thumbnail),
    sections,
  };
}

/**
 * Parse a YTMusic subtitle runs array to extract artist names.
 * Subtitle often looks like: "Artist • 2023" or "2 songs"
 */
function parseSubtitleArtists(subtitle: any): Artist[] {
  if (!subtitle) return [];
  const runs: any[] = subtitle?.runs || (typeof subtitle === 'object' ? [] : []);
  return runs
    .filter((r: any) => r.endpoint?.browseEndpoint?.browseId?.startsWith('UC'))
    .map((r: any): Artist => ({
      id: r.endpoint.browseEndpoint.browseId,
      name: r.text,
    }));
}

export function mapAlbumDetails(album: any): AlbumDetails {
  return {
    id: album.header?.id || '',
    title: album.header?.title?.text || '',
    artists: (album.header?.artists || []).map(mapArtist),
    year: album.header?.year?.text || album.header?.year,
    thumbnail: mapThumbnail(album.header?.thumbnail),
    tracks: (album.contents || []).map(mapTrack),
    description: album.description,
  };
}
