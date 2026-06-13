'use client';
import { useState, useEffect } from 'react';
import { blendService } from '@/lib/services/blendService';
import { EmptyState } from '@/components/shared/EmptyState';
import { Music, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function BlendPage() {
  const [blends, setBlends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    blendService.getBlends()
      .then((data) => setBlends(Array.isArray(data) ? data : []))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-zinc-800 animate-pulse rounded mb-4" />
        <div className="space-y-2">
          <div className="h-16 w-full bg-zinc-800 animate-pulse rounded" />
          <div className="h-16 w-full bg-zinc-800 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Your Blends</h1>
        {blends.length > 0 && (
          <Button size="sm" className="gap-2">
            <Plus size={18} />
            Create Blend
          </Button>
        )}
      </div>

      {blends.length === 0 ? (
        <EmptyState
          icon={<Music />}
          title="No Blends yet"
          description="Start a Blend with a friend to discover music you both love"
          action={
            <Button className="gap-2">
              <Plus size={18} />
              Create your first Blend
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blends.map((blend: any) => (
            <div key={blend.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  <div className="h-10 w-10 rounded-full bg-red-600 border-2 border-zinc-900" />
                  <div className="h-10 w-10 rounded-full bg-blue-600 border-2 border-zinc-900" />
                </div>
                <div>
                  <p className="font-bold text-white">Blend with Friend</p>
                  <p className="text-xs text-zinc-500">Updated recently</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
