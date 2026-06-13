'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, Library, Music2, PlusSquare, Heart, Disc, Radio, TrendingUp, Download, Plus, Headphones, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/lib/stores/userStore';
import { usePlaylistStore } from '@/lib/stores/playlistStore';
import { useJamStore } from '@/lib/stores/jamStore';
import { apiClient } from '@/lib/api/client';
import { CollaborateModal } from '@/components/collaborate/CollaborateModal';

const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Heart, label: 'Liked Songs', href: '/playlist/liked' },
  { icon: Download, label: 'Downloads', href: '/downloads' },
];

interface LibraryItem {
  id: string;
  type: 'playlist' | 'album' | 'artist';
  title: string;
  subtitle: string;
  thumbnail_url: string | null;
}

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUserStore();
  const { playlists, fetchPlaylists, createPlaylist } = usePlaylistStore();
  const jamActive = useJamStore((s) => s.active);
  const startJam = useJamStore((s) => s.startJam);
  const setShowInvite = useJamStore((s) => s.setShowInvite);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [isCollabOpen, setIsCollabOpen] = useState(false);

  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'playlist' | 'album' | 'artist'>('all');

  const fetchLibraryData = async () => {
    if (user) {
      try {
        const items = await apiClient<LibraryItem[]>('/library/items');
        setLibraryItems(items);
      } catch (err) {
        console.warn('Failed to fetch library items:', err);
      }
    } else {
      // Local storage fallbacks
      const items: LibraryItem[] = [];

      // 1. Local Playlists
      const localPlaylistsRaw = typeof window !== 'undefined' ? localStorage.getItem('zha-local-playlists') : null;
      const localPlaylists = localPlaylistsRaw ? JSON.parse(localPlaylistsRaw) : [];
      localPlaylists.forEach((p: any) => {
        items.push({
          id: p.id,
          type: 'playlist',
          title: p.title,
          subtitle: 'Playlist â€¢ Local',
          thumbnail_url: null
        });
      });

      // 2. Local Liked Albums
      const localAlbumsRaw = typeof window !== 'undefined' ? localStorage.getItem('zha-local-liked-albums') : null;
      const localAlbums = localAlbumsRaw ? JSON.parse(localAlbumsRaw) : [];
      localAlbums.forEach((a: any) => {
        items.push({
          id: a.album_id,
          type: 'album',
          title: a.title,
          subtitle: `Album â€¢ ${a.artist_name}`,
          thumbnail_url: a.thumbnail_url
        });
      });

      // 3. Local Followed Artists
      const localArtistsRaw = typeof window !== 'undefined' ? localStorage.getItem('zha-local-followed-artists') : null;
      const localArtists = localArtistsRaw ? JSON.parse(localArtistsRaw) : [];
      localArtists.forEach((art: any) => {
        items.push({
          id: art.channel_id,
          type: 'artist',
          title: art.name,
          subtitle: 'Artist',
          thumbnail_url: art.thumbnail_url
        });
      });

      setLibraryItems(items);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists, user]);

  useEffect(() => {
    fetchLibraryData();
  }, [user, pathname, playlists]);

  // Listen for library-update events dispatched from album/artist pages
  useEffect(() => {
    const handleLibraryUpdate = () => fetchLibraryData();
    window.addEventListener('library-update', handleLibraryUpdate);
    return () => window.removeEventListener('library-update', handleLibraryUpdate);
  }, [user]);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistTitle.trim()) return;
    try {
      const newPlaylist = await createPlaylist(playlistTitle, playlistDesc);
      setPlaylistTitle('');
      setPlaylistDesc('');
      setIsModalOpen(false);
      await fetchLibraryData();
      router.push(`/playlist/${newPlaylist.id}`);
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  const filteredItems = activeFilter === 'all'
    ? libraryItems
    : libraryItems.filter(item => item.type === activeFilter);

  return (
    <div className="hidden md:flex flex-col w-[298px] bg-black border-r border-white/10 h-screen sticky top-0 shrink-0 overflow-y-auto z-50">
      <div className="p-6">
        <Link href="/" className="flex items-center">
          <Image src="/logo.jpeg" alt="Zha" width={72} height={72} className="rounded-full" priority unoptimized />
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-3 py-3 rounded-lg transition-all group",
                isActive 
                  ? "bg-zinc-800 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              )}
            >
              <item.icon className={cn(
                "w-6 h-6",
                isActive ? "text-red-600" : "group-hover:text-red-600 transition-colors"
              )} />
              <span className="font-semibold">{item.label}</span>
            </Link>
          );
        })}

        {/* Jam — start a shared listening session, or open the live one */}
        <button
          onClick={() => (jamActive ? setShowInvite(true) : startJam())}
          className={cn(
            "w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-all group",
            jamActive ? "bg-red-500/15 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          )}
        >
          <Headphones className={cn("w-6 h-6", jamActive ? "text-red-500" : "group-hover:text-red-600 transition-colors")} />
          <span className="font-semibold">{jamActive ? "Jam · Live" : "Start a Jam"}</span>
          {jamActive && (
            <span className="relative flex h-2 w-2 ml-auto">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
        </button>

        {/* Collaborate — create a shared playlist and get a sharing link */}
        <button
          onClick={() => setIsCollabOpen(true)}
          className="w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-all group text-zinc-400 hover:text-white hover:bg-zinc-900"
        >
          <Users className="w-6 h-6 group-hover:text-[#2E7DF7] transition-colors" />
          <span className="font-semibold">Collaborate</span>
        </button>

        {/* Your Library Section */}
        <div className="pt-6 pb-2 border-t border-white/5 mt-4">
          <div className="flex items-center justify-between px-3 mb-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Library size={20} />
              <span className="font-bold text-sm">Your Library</span>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-1 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
              title="Create playlist"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 px-3 mb-4 overflow-x-auto no-scrollbar">
            {[
              { id: 'playlist', label: 'Playlists' },
              { id: 'album', label: 'Albums' },
              { id: 'artist', label: 'Artists' }
            ].map((pill) => {
              const isActive = activeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setActiveFilter(isActive ? 'all' : pill.id as any)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold select-none transition-colors shrink-0",
                    isActive
                      ? "bg-[#2E7DF7] text-white"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Library Items List */}
          <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto no-scrollbar px-1">
            {filteredItems.length === 0 ? (
              <p className="text-zinc-500 text-xs px-3 py-2">Your library is empty.</p>
            ) : (
              filteredItems.map((item) => {
                const itemHref = item.type === 'playlist' ? `/playlist/${item.id}` : item.type === 'album' ? `/album/${item.id}` : `/artist/${item.id}`;
                const isActive = pathname === itemHref;
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={itemHref}
                    className={cn(
                      "flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors group cursor-pointer",
                      isActive ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                    )}
                  >
                    <div className={cn(
                      "relative w-10 h-10 flex-shrink-0 bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center",
                      item.type === 'artist' ? 'rounded-full' : 'rounded-md'
                    )}>
                      {item.thumbnail_url ? (
                        <Image
                          src={item.thumbnail_url}
                          alt={item.title}
                          fill
                          className={cn("object-cover", item.type === 'artist' ? 'rounded-full' : 'rounded-md')}
                          unoptimized
                        />
                      ) : (
                        <Music2 size={16} className="text-zinc-500" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.title}</p>
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </nav>

      <div className="p-4 mt-auto border-t border-white/5">
        {user ? (
         <div className="bg-zinc-900/50 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Logged in as</p>
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold">
                 {user.email?.charAt(0).toUpperCase()}
               </div>
               <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user.email?.split('@')[0]}</p>
                  <Link href="/profile" className="text-[10px] text-zinc-400 hover:text-white">View Profile</Link>
               </div>
            </div>
         </div>
        ) : (
          <div className="bg-zinc-900/50 rounded-xl p-4 text-center">
             <p className="text-xs text-zinc-400 mb-3">Sign in to sync your library</p>
             <button 
               onClick={() => useUserStore.getState().signInWithGoogle()}
               className="w-full bg-white text-black text-xs font-bold py-2 rounded-full hover:bg-zinc-200 transition-colors"
             >
               Sign In
             </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-white mb-4">Create New Playlist</h2>
            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Playlist Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Awesome Mix"
                  value={playlistTitle}
                  onChange={(e) => setPlaylistTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="e.g. Songs for a rainy day"
                  value={playlistDesc}
                  onChange={(e) => setPlaylistDesc(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition-colors h-24 resize-none text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CollaborateModal open={isCollabOpen} onClose={() => setIsCollabOpen(false)} />
    </div>
  );
};

