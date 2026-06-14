import { getSupabase } from './client';

/**
 * Phase 17 · Slice 2 — supabase-js data access (replaces the FastAPI data layer).
 *
 * SCAFFOLDING: these are written but NOT yet wired into the stores, so the app
 * keeps using the FastAPI endpoints (working dev) until the identity+RLS
 * migration (supabase/migrations/0001_phase17_identity_and_rls.sql) is applied.
 * Once it is, playlistStore / userDataService get flipped to call these.
 *
 * RLS does the authorization: every SELECT is auto-filtered to the signed-in
 * user's rows, and inserts must set the owner column to auth.uid() (enforced by
 * the policies' WITH CHECK).
 */

async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) throw new Error('Not signed in');
  return data.user.id;
}

// ── Playlists ───────────────────────────────────────────────────────────────
export interface DbPlaylist {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  owner_id: string;
  is_collaborative: boolean;
}
const PLAYLIST_COLS = 'id,title,description,cover_url,owner_id,is_collaborative';

export async function listPlaylists(): Promise<DbPlaylist[]> {
  const { data, error } = await getSupabase()
    .from('playlists')
    .select(PLAYLIST_COLS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbPlaylist[];
}

export async function createPlaylist(title: string, description = ''): Promise<DbPlaylist> {
  const owner_id = await currentUserId();
  const { data, error } = await getSupabase()
    .from('playlists')
    .insert({ title, description, owner_id })
    .select(PLAYLIST_COLS)
    .single();
  if (error) throw error;
  return data as DbPlaylist;
}

export async function deletePlaylist(id: number): Promise<void> {
  const { error } = await getSupabase().from('playlists').delete().eq('id', id);
  if (error) throw error;
}

export interface DbPlaylistDetails extends DbPlaylist {
  songs: { song_id: string; position: number }[];
}

export async function getPlaylistDetails(id: number): Promise<DbPlaylistDetails> {
  const { data, error } = await getSupabase()
    .from('playlists')
    .select(`${PLAYLIST_COLS}, playlist_songs(song_id,position)`)
    .eq('id', id)
    .single();
  if (error) throw error;
  const songs = ((data.playlist_songs ?? []) as { song_id: string; position: number }[])
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ song_id: s.song_id, position: s.position }));
  const { playlist_songs, ...playlist } = data as DbPlaylist & { playlist_songs: unknown };
  return { ...(playlist as DbPlaylist), songs };
}

export async function addSongToPlaylist(playlistId: number, songId: string): Promise<void> {
  const supabase = getSupabase();
  // append after the current max position (matches the FastAPI 1000-gap scheme)
  const { data: last } = await supabase
    .from('playlist_songs')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? 0) + 1000;
  const { error } = await supabase
    .from('playlist_songs')
    .insert({ playlist_id: playlistId, song_id: songId, position });
  if (error) throw error;
}

export async function removeSongFromPlaylist(playlistId: number, songId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('song_id', songId);
  if (error) throw error;
}

// ── Play history ─────────────────────────────────────────────────────────────
export interface RecentTrack {
  video_id: string;
  title: string;
  artist: string;
  thumbnail_url: string | null;
  played_at: string | null;
}

export async function recordPlay(t: {
  video_id: string;
  title: string;
  artist: string;
  thumbnail_url: string | null;
}): Promise<void> {
  const user_id = await currentUserId();
  // play_history.id (UUID) and play_duration_seconds (NOT NULL) have no DB
  // default — the old SQLAlchemy layer supplied them, so we must here too.
  await getSupabase().from('play_history').insert({
    id: crypto.randomUUID(),
    user_id,
    play_duration_seconds: 0,
    ...t,
  });
}

export async function getRecentlyPlayed(limit = 20): Promise<RecentTrack[]> {
  const { data, error } = await getSupabase()
    .from('play_history')
    .select('video_id,title,artist,thumbnail_url,played_at')
    .order('played_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RecentTrack[];
}

// ── Library (combined playlists + liked albums + followed artists) ────────────
export interface LibraryItem {
  id: string;
  type: 'playlist' | 'album' | 'artist';
  title: string;
  subtitle: string;
  thumbnail_url: string | null;
}

export async function getLibraryItems(): Promise<LibraryItem[]> {
  const supabase = getSupabase();
  // RLS scopes each table to the signed-in user automatically.
  const [pl, al, ar] = await Promise.all([
    supabase.from('playlists').select('id,title').order('created_at', { ascending: false }),
    supabase.from('liked_albums').select('album_id,title,artist_name,thumbnail_url').order('liked_at', { ascending: false }),
    supabase.from('followed_artists').select('channel_id,name,thumbnail_url').order('followed_at', { ascending: false }),
  ]);
  if (pl.error) throw pl.error;
  if (al.error) throw al.error;
  if (ar.error) throw ar.error;
  const items: LibraryItem[] = [];
  for (const p of pl.data ?? []) {
    items.push({ id: String(p.id), type: 'playlist', title: p.title, subtitle: 'Playlist • You', thumbnail_url: null });
  }
  for (const a of al.data ?? []) {
    items.push({ id: a.album_id, type: 'album', title: a.title, subtitle: `Album • ${a.artist_name}`, thumbnail_url: a.thumbnail_url });
  }
  for (const r of ar.data ?? []) {
    items.push({ id: r.channel_id, type: 'artist', title: r.name, subtitle: 'Artist', thumbnail_url: r.thumbnail_url });
  }
  return items;
}

// ── Liked albums ─────────────────────────────────────────────────────────────
export async function isAlbumLiked(albumId: string): Promise<boolean> {
  const { data } = await getSupabase().from('liked_albums').select('album_id').eq('album_id', albumId).maybeSingle();
  return !!data;
}

export async function likeAlbum(a: {
  album_id: string;
  title: string;
  artist_name: string;
  thumbnail_url: string | null;
}): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from('liked_albums')
    .upsert({ user_id, ...a }, { onConflict: 'user_id,album_id' });
  if (error) throw error;
}

export async function unlikeAlbum(albumId: string): Promise<void> {
  const { error } = await getSupabase().from('liked_albums').delete().eq('album_id', albumId);
  if (error) throw error;
}

// ── Followed artists ─────────────────────────────────────────────────────────
export async function isArtistFollowed(channelId: string): Promise<boolean> {
  const { data } = await getSupabase().from('followed_artists').select('channel_id').eq('channel_id', channelId).maybeSingle();
  return !!data;
}

export async function followArtist(a: {
  channel_id: string;
  name: string;
  thumbnail_url: string | null;
}): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from('followed_artists')
    .upsert({ user_id, ...a }, { onConflict: 'user_id,channel_id' });
  if (error) throw error;
}

export async function unfollowArtist(channelId: string): Promise<void> {
  const { error } = await getSupabase().from('followed_artists').delete().eq('channel_id', channelId);
  if (error) throw error;
}
