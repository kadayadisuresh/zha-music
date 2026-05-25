"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { usePlaybackStore } from "@/lib/stores/playbackStore";
import { audioEngine } from "@/lib/audio/AudioEngine";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  const { user, checkSession, isLoading } = useUserStore();
  const { isPlaying, currentTime, duration, isLoading: isAudioLoading, currentTrack } = usePlaybackStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [testVideoId, setTestVideoId] = useState("dQw4w9WgXcQ");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (user) {
      router.push("/profile");
    }
  }, [user, router]);

  const handleLogin = () => {
    window.location.href = "http://localhost:8000/auth/google";
  };

  const handlePlay = () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play(testVideoId, { 
        id: testVideoId, 
        title: "Test Track", 
        artists: [{ name: "Artist" }] 
      });
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Prevent hydration mismatch by not rendering anything until mounted
  if (!mounted || isLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-900 border-t-transparent dark:border-zinc-50 dark:border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:px-6 lg:px-8">
      <main className="flex w-full max-w-md flex-col items-center justify-center text-center">
        <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-red-600 text-6xl font-bold text-white shadow-lg">
          ഴ
        </div>
        
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          zha
        </h1>
        
        <p className="mb-10 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Your personal YouTube Music. Free. Private. For you and your friends.
        </p>

        <div className="mb-12 w-full">
          <Button
            onClick={handleLogin}
            size="lg"
            className="w-full sm:w-auto shadow-md mb-8"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-8 mt-4 text-left">
            <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">Test Audio Player</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={testVideoId}
                onChange={(e) => setTestVideoId(e.target.value)}
                placeholder="YouTube Video ID"
                className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-2 text-zinc-900 dark:text-zinc-100"
              />
              <Button onClick={handlePlay} disabled={isAudioLoading}>
                {isAudioLoading ? "..." : (isPlaying ? "Pause" : "Play")}
              </Button>
            </div>
            
            {currentTrack && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => audioEngine.seek(parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  Now Playing: {currentTrack.title}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
