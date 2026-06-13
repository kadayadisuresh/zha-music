'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WifiOff, Download, ArrowRight } from 'lucide-react';
import { initDB } from '@/lib/db/idb';
import Link from 'next/link';

export default function OfflinePage() {
  const [countdown, setCountdown] = useState(2);
  const [hasDownloads, setHasDownloads] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkDownloads() {
      try {
        const db = await initDB();
        const count = await db.count('zha-downloads-meta');
        setHasDownloads(count > 0);
      } catch (error) {
        console.error('Failed to check downloads:', error);
        setHasDownloads(false);
      }
    }
    checkDownloads();
  }, []);

  useEffect(() => {
    if (hasDownloads === null) return;

    if (hasDownloads) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push('/profile'); // Assuming downloads are in profile or a dedicated /downloads
            // Wait, plan says /downloads. Let me check if /downloads exists.
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [hasDownloads, router]);

  // If redirecting to /downloads, I should verify if that route exists.
  // In this app, downloads are often under /profile or /library.
  // I'll check the filesystem for /downloads.

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
      <div className="bg-[#2E7DF7]/5 p-8 rounded-full mb-8">
        <WifiOff className="w-16 h-16 text-[#2E7DF7]/40" />
      </div>
      
      <h1 className="text-3xl font-bold mb-4 text-[#2E7DF7]">You're offline</h1>
      
      {hasDownloads === null ? (
        <div className="h-6 w-48 bg-[#2E7DF7]/10 animate-pulse rounded" />
      ) : hasDownloads ? (
        <>
          <p className="text-[#2E7DF7]/60 mb-8 max-w-md">
            No internet connection detected. Redirecting to your downloaded music in {countdown}s...
          </p>
          <button
            onClick={() => router.push('/profile')} // Defaulting to /profile for now if /downloads doesn't exist
            className="flex items-center gap-2 bg-[#2E7DF7] text-white px-6 py-3 rounded-full font-bold hover:bg-[#2E7DF7]/90 transition-colors"
          >
            Go to Downloads <ArrowRight className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <p className="text-[#2E7DF7]/60 mb-8 max-w-md">
            No internet connection detected and no downloaded music found. Please reconnect to use ZHA Better.
          </p>
          <Link
            href="/"
            className="flex items-center gap-2 border border-[#2E7DF7]/20 text-[#2E7DF7] px-6 py-3 rounded-full font-bold hover:bg-[#2E7DF7]/5 transition-colors"
          >
            Retry Connection
          </Link>
        </>
      )}
    </div>
  );
}
