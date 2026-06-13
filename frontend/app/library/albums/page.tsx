'use client';

import React from 'react';
import { Disc } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function AlbumsPage() {
  return (
    <div className="p-8 max-w-screen-2xl mx-auto pb-32">
      <h1 className="text-3xl font-bold mb-8">Saved Albums</h1>
      <EmptyState 
        icon={<Disc />} 
        title="No albums saved" 
        description="When you save albums, they will appear here." 
      />
    </div>
  );
}
