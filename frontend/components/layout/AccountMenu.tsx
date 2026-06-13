'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { User as UserIcon, LogOut } from 'lucide-react';
import { useUserStore } from '@/lib/stores/userStore';

/** Account avatar + dropdown in the header (View Profile / Sign Out). Gives
 *  mobile users an entry point to their account, since the sidebar is hidden. */
export const AccountMenu = () => {
  const router = useRouter();
  const { user, logout } = useUserStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!user) return null;

  const initial = (user.display_name || user.email || '?').charAt(0).toUpperCase();

  const goProfile = () => {
    setOpen(false);
    router.push('/profile');
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        title="Account"
        className="w-9 h-9 rounded-full overflow-hidden bg-[#2E7DF7] flex items-center justify-center text-white text-sm font-bold ring-2 ring-transparent hover:ring-white/25 transition shrink-0"
      >
        {user.avatar_url ? (
          <Image src={user.avatar_url} alt="" width={36} height={36} className="w-9 h-9 object-cover" unoptimized />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in duration-150">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-bold text-white truncate">{user.display_name || user.email?.split('@')[0]}</p>
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={goProfile}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-200 hover:bg-white/5 transition-colors"
          >
            <UserIcon size={16} /> View Profile
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
};
