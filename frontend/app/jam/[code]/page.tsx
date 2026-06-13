"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api/client";
import { useUserStore } from "@/lib/stores/userStore";
import { useJamStore } from "@/lib/stores/jamStore";

interface JoinJamProps {
  params: Promise<{ code: string }>;
}

export default function JoinJamPage({ params }: JoinJamProps) {
  const { code } = use(params);
  const router = useRouter();
  const { checkSession } = useUserStore();
  const joinSession = useJamStore((s) => s.joinSession);
  const [status, setStatus] = useState<"loading" | "needs-auth" | "error" | "full">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await checkSession();
      try {
        const res = await fetch(`${API_BASE_URL}/jam/join/${code}`, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) return setStatus("needs-auth");
        if (res.status === 409) return setStatus("full");
        if (!res.ok) return setStatus("error");
        const data = await res.json();
        joinSession(data.session_id, data.role === "host", data.join_code);
        router.replace("/");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, checkSession, joinSession, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-6">
        <Radio className="w-8 h-8 text-red-400" />
      </div>

      {status === "loading" && (
        <>
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mb-3" />
          <p className="text-zinc-300">Joining the Jam…</p>
        </>
      )}

      {status === "needs-auth" && (
        <>
          <h1 className="text-xl font-bold text-white mb-2">Sign in to join</h1>
          <p className="text-zinc-400 text-sm mb-5">You need an account to listen along.</p>
          <button
            onClick={() => {
              document.cookie = `oauth_return_to=${encodeURIComponent(`/jam/${code}`)}; path=/`;
              window.location.href = `${API_BASE_URL}/auth/google`;
            }}
            className="bg-white text-black font-bold px-6 py-3 rounded-full hover:bg-zinc-200 transition-colors"
          >
            Continue with Google
          </button>
        </>
      )}

      {status === "full" && (
        <>
          <h1 className="text-xl font-bold text-white mb-2">Session is full</h1>
          <p className="text-zinc-400 text-sm mb-5">A Jam can have at most 10 people.</p>
          <button onClick={() => router.push("/")} className="bg-zinc-800 text-white font-semibold px-6 py-3 rounded-full hover:bg-zinc-700 transition-colors">
            Go Home
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-xl font-bold text-white mb-2">Jam not found or ended</h1>
          <p className="text-zinc-400 text-sm mb-5">Ask the host for a fresh invite link.</p>
          <button onClick={() => router.push("/")} className="bg-zinc-800 text-white font-semibold px-6 py-3 rounded-full hover:bg-zinc-700 transition-colors">
            Go Home
          </button>
        </>
      )}
    </div>
  );
}
