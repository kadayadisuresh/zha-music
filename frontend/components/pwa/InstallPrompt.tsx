'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);

      // Check if user has already dismissed the prompt
      const isDismissed = localStorage.getItem('pwa_prompt_dismissed');
      
      if (!isDismissed) {
        // Wait 2 minutes before showing the prompt
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 120000); // 2 minutes

        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[100] bg-[#111a2e] border border-[#2E7DF7]/10 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start gap-4">
        <div className="bg-[#2E7DF7] p-3 rounded-lg">
          <Download className="w-6 h-6 text-black" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-[#2E7DF7] text-lg">Install ZHA Better</h3>
          <p className="text-sm text-[#2E7DF7]/70 mt-1">
            Install our app for a better experience, offline support, and quick access.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleInstall}
              className="flex-1 bg-[#2E7DF7] text-white font-semibold py-2 px-4 rounded-full text-sm hover:bg-[#2E7DF7]/90 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-sm font-semibold text-[#2E7DF7]/70 hover:text-[#2E7DF7] transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button 
          onClick={handleDismiss}
          className="text-[#2E7DF7]/40 hover:text-[#2E7DF7]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
