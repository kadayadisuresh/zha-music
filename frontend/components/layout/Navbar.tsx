'use client';

import React, { useState, Suspense } from 'react';
import { SearchBar } from '../search/SearchBar';
import { useUserStore } from '@/lib/stores/userStore';
import { Bell, Settings } from 'lucide-react';
import { Button } from '../ui/Button';
import { SettingsModal } from '../settings/SettingsModal';
import { AccountMenu } from './AccountMenu';

export const Navbar = () => {
  const { user } = useUserStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-black/60 backdrop-blur-md border-b border-white/5 h-16 shrink-0">
      <div className="flex items-center justify-between h-full px-6 max-w-screen-2xl mx-auto gap-8">
        {/* Search Bar - Hidden on mobile if needed, but for now let's keep it */}
        <div className="flex-1 max-w-xl">
          <Suspense fallback={<div className="h-10 w-full rounded-full bg-white/5" />}>
            <SearchBar />
          </Suspense>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {user && (
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
              <Bell size={20} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
            className="text-zinc-400 hover:text-white"
          >
            <Settings size={20} />
          </Button>
          {!user && (
            <Button
              onClick={() => useUserStore.getState().signInWithGoogle()}
              size="sm"
              className="bg-white text-black hover:bg-zinc-200 rounded-full font-bold px-4"
            >
              Sign In
            </Button>
          )}
          <AccountMenu />
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
};
