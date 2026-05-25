import React from 'react';

export const SearchSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Top Result Skeleton */}
      <section>
        <div className="h-6 w-32 bg-zinc-800 rounded mb-4"></div>
        <div className="flex gap-6">
          <div className="h-48 w-48 bg-zinc-800 rounded-lg"></div>
          <div className="flex-1 space-y-4">
            <div className="h-8 w-64 bg-zinc-800 rounded"></div>
            <div className="h-4 w-32 bg-zinc-800 rounded"></div>
            <div className="h-10 w-24 bg-zinc-800 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Shelves Skeletons */}
      {[1, 2, 3].map((i) => (
        <section key={i}>
          <div className="h-6 w-24 bg-zinc-800 rounded mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="space-y-2">
                <div className="aspect-square bg-zinc-800 rounded-md"></div>
                <div className="h-4 w-3/4 bg-zinc-800 rounded"></div>
                <div className="h-3 w-1/2 bg-zinc-800 rounded"></div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
