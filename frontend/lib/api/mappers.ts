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

export function mapTrack(item: any): Track {
  const title = (typeof item.title === 'string' ? item.title : item.title?.text) || item.name || 'Unknown';
  return {
    id: item.id || item.video_id,
    title,
    artists: (item.artists || item.authors || []).map(mapArtist),
    album: item.album ? { 
      id: item.album.id || item.album.browse_id, 
      name: (typeof item.album.name === 'string' ? item.album.name : item.album.text) 
    } : undefined,
    duration: item.duration?.seconds || 0,
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
    items: (section.contents || []).map((item: any) => {
      if (item.type === 'MusicResponsiveListItem') {
        if (item.item_type === 'song' || item.item_type === 'video') return mapTrack(item);
        if (item.item_type === 'album') return mapAlbum(item);
        if (item.item_type === 'artist') return mapSearchArtist(item);
      }
      return item; // Fallback
    }),
  }));

  return {
    id: artist.header?.id || '',
    name: artist.header?.name?.text || '',
    description: artist.header?.description?.text,
    thumbnail: mapThumbnail(artist.header?.thumbnail),
    header_thumbnail: mapThumbnail(artist.header?.header_thumbnail),
    sections,
  };
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
