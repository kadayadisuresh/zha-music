"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/userStore";
import { Button } from "@/components/ui/Button";

import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";

export default function ProfilePage() {
  const { user, isLoading, checkSession, logout } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (isLoading || !user) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:px-6 lg:px-8">
      <main className="flex w-full max-w-md flex-col items-center justify-center text-center rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="mb-6 h-24 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 shadow-sm">
          {/* We will add an actual avatar if available, using initials for now */}
          <div className="flex h-full w-full items-center justify-center bg-red-600 text-3xl font-bold text-white">
            {user.email ? user.email.charAt(0).toUpperCase() : "U"}
          </div>
        </div>
        
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Profile
        </h1>
        
        <div className="mb-8 flex flex-col space-y-2 text-zinc-600 dark:text-zinc-400">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{user.email}</p>
        </div>

        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full"
        >
          Sign Out
        </Button>
      </main>
    </div>
  );
}
