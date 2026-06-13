'use client';

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#2E7DF7]/10", className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-3 w-[60%]" />
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="flex items-center gap-4 py-2">
      <Skeleton className="h-12 w-12 rounded-md shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="h-3 w-[20%]" />
      </div>
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}
