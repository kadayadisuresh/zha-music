'use client';

import { Skeleton } from "@/components/ui/Skeleton";

export function ArtistSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header Skeleton */}
      <div className="relative h-[40vh] min-h-[300px] w-full">
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-zinc-900 animate-pulse" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>
        
        <div className="absolute bottom-0 left-0 p-8 z-10 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-6 mb-4">
            <Skeleton className="h-16 md:h-24 w-[60%] rounded-lg" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-[40%] mb-2" />
          <Skeleton className="h-4 w-[30%]" />
        </div>
      </div>

      {/* Sections Skeleton */}
      <div className="max-w-7xl mx-auto px-8 py-10 space-y-12">
        {[1, 2].map((i) => (
          <section key={i}>
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-12 w-12 rounded-md shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[60%]" />
                    <Skeleton className="h-3 w-[40%]" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
