'use client';

import { Skeleton } from "@/components/ui/Skeleton";

export function ProfileSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:px-6 lg:px-8">
      <main className="flex w-full max-w-md flex-col items-center justify-center text-center rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <Skeleton className="mb-6 h-24 w-24 rounded-full" />
        <Skeleton className="mb-2 h-8 w-32" />
        <div className="mb-8 flex flex-col items-center space-y-2">
          <Skeleton className="h-4 w-48" />
          <div className="flex justify-center space-x-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
      </main>
    </div>
  );
}
