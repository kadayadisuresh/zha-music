"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Music2, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api/client";
import { useUserStore } from "@/lib/stores/userStore";

interface JoinPageProps {
  params: Promise<{ token: string }>;
}

export default function JoinPlaylistPage({ params }: JoinPageProps) {
  const { token } = use(params);
  const router = useRouter();
  const { user, checkSession } = useUserStore();
  const [status, setStatus] = useState<"loading" | "needs-auth" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Ensure we know the session state first
      await checkSession();
      try {
        const res = await fetch(`${API_BASE_URL}/playlist/join/${token}`, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          setStatus("needs-auth");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = await res.json();
        router.replace(`/playlist/${data.playlist_id}`);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, checkSession, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-6">
        <Music2 className="w-8 h-8 text-[#2E7DF7]" />
      </div>

      {status === "loading" && (
        <>
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-3" />
          <p className="text-zinc-300">Joining playlist…</p>
        </>
      )}

      {status === "needs-auth" && (
        <>
          <h1 className="text-xl font-bold text-white mb-2">Sign in to join</h1>
          <p className="text-zinc-400 text-sm mb-5">You need an account to collaborate on this playlist.</p>
          <button
            onClick={() => {
              document.cookie = `oauth_return_to=${encodeURIComponent(`/playlist/join/${token}`)}; path=/`;
              window.location.href = `${API_BASE_URL}/auth/google`;
            }}
            className="bg-white text-black font-bold px-6 py-3 rounded-full hover:bg-zinc-200 transition-colors"
          >
            Continue with Google
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-xl font-bold text-white mb-2">Invite invalid or expired</h1>
          <p className="text-zinc-400 text-sm mb-5">Ask the owner for a fresh invite link.</p>
          <button
            onClick={() => router.push("/")}
            className="bg-zinc-800 text-white font-semibold px-6 py-3 rounded-full hover:bg-zinc-700 transition-colors"
          >
            Go Home
          </button>
        </>
      )}
    </div>
  );
}
