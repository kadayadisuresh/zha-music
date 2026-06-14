'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Library, Plus, X, Music2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/uiStore';
import { CollaborateModal } from '@/components/collaborate/CollaborateModal';
import { CreatePlaylistModal } from '@/components/shared/CreatePlaylistModal';

const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Your Library', href: '/library', icon: Library },
];

/**
 * Spotify-style bottom navigation for mobile/tablet (hidden on desktop, which
 * keeps the sidebar). Home / Search / Your Library + a Create tab that opens a
 * slide-up sheet. The Create tab turns into an X while the sheet is open.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  // The full player is a full-screen takeover — hide the bottom nav while it's
  // open so it doesn't cover the player's Up Next / Lyrics / Related tabs.
  const isPlayerExpanded = useUIStore((s) => s.isPlayerExpanded);

  const [showCreate, setShowCreate] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);

  if (isPlayerExpanded) return null;

  const createOptions = [
    {
      icon: Music2,
      title: 'Playlist',
      desc: 'Create a playlist with songs or episodes',
      onClick: () => { setShowCreate(false); setShowPlaylist(true); },
    },
    {
      icon: Users,
      title: 'Collaborative playlist',
      desc: 'Create a playlist together with friends',
      onClick: () => { setShowCreate(false); setShowCollab(true); },
    },
  ];

  return (
    <>
      {/* ── Create sheet (mobile only) ── */}
      <div className={cn('md:hidden fixed inset-0 z-[60]', showCreate ? '' : 'pointer-events-none')}>
        {/* Backdrop */}
        <div
          onClick={() => setShowCreate(false)}
          className={cn('absolute inset-0 bg-black/60 transition-opacity duration-300', showCreate ? 'opacity-100' : 'opacity-0')}
        />
        {/* Sheet panel — sits just above the bottom nav (h-16) */}
        <div
          className={cn(
            'absolute left-0 right-0 bottom-16 bg-zinc-900 rounded-t-2xl border-t border-white/10 pt-3 pb-4 shadow-2xl transition-transform duration-300 ease-out',
            showCreate ? 'translate-y-0' : 'translate-y-[120%]'
          )}
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700 mb-3" />
          <div className="px-2">
            {createOptions.map((o) => (
              <button
                key={o.title}
                onClick={o.onClick}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl active:bg-white/5 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                  <o.icon size={22} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-[15px] leading-tight">{o.title}</p>
                  <p className="text-zinc-400 text-xs mt-0.5 leading-snug">{o.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom navigation bar (mobile only) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[65] h-16 bg-black/95 backdrop-blur-md border-t border-white/10 flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setShowCreate(false)}
              className="flex-1 flex flex-col items-center justify-center gap-1"
            >
              <item.icon size={22} className={active ? 'text-white' : 'text-zinc-500'} strokeWidth={active ? 2.4 : 2} />
              <span className={cn('text-[10px] font-medium', active ? 'text-white' : 'text-zinc-500')}>{item.label}</span>
            </Link>
          );
        })}

        {/* Create / close-sheet tab */}
        <button
          onClick={() => setShowCreate((v) => !v)}
          aria-label={showCreate ? 'Close' : 'Create'}
          className="flex-1 flex flex-col items-center justify-center gap-1"
        >
          {showCreate ? (
            <span className="w-9 h-9 -my-1.5 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
              <X size={20} />
            </span>
          ) : (
            <>
              <Plus size={24} className="text-zinc-500" />
              <span className="text-[10px] font-medium text-zinc-500">Create</span>
            </>
          )}
        </button>
      </nav>

      {/* Sub-flows launched from the Create sheet */}
      <CreatePlaylistModal open={showPlaylist} onClose={() => setShowPlaylist(false)} />
      <CollaborateModal open={showCollab} onClose={() => setShowCollab(false)} />
    </>
  );
}
