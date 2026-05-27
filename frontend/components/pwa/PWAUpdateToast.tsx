'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { usePlaybackStore } from '@/lib/stores/playbackStore';

export default function PWAUpdateToast() {
  const [showToast, setShowToast] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const isPlaying = usePlaybackStore(state => state.isPlaying);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(reg => {
      setRegistration(reg);

      const onUpdateFound = () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available!
              setShowToast(true);
            }
          });
        }
      };

      reg.addEventListener('updatefound', onUpdateFound);

      // Check if there is already a waiting worker
      if (reg.waiting) {
        setShowToast(true);
      }
    });
  }, []);

  const handleUpdate = useCallback(() => {
    if (!registration || !registration.waiting) {
      // If skipWaiting was true, it might already be active but we need reload
      window.location.reload();
      return;
    }

    // Message the waiting worker to skipWaiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    // Listen for the controllerchange event to reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, [registration]);

  // Effect to automatically update when song ends if a toast is pending
  useEffect(() => {
    if (showToast && !isPlaying) {
      // Small delay to ensure the UI has updated after song ended
      const timer = setTimeout(() => {
        handleUpdate();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showToast, isPlaying, handleUpdate]);

  if (!showToast) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-[#f5f0e8] text-black rounded-full px-4 py-3 shadow-2xl flex items-center justify-between gap-4 border border-black/10">
        <div className="flex items-center gap-3">
          <div className="bg-black/10 p-2 rounded-full animate-spin-slow">
            <RefreshCw className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold">New version available</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            className="bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-black/80 transition-colors"
          >
            Update now
          </button>
          <button 
            onClick={() => setShowToast(false)}
            className="p-1 hover:bg-black/5 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
