'use client';
import { useState, useEffect } from 'react';
import { blendService } from '@/lib/services/blendService';

export default function BlendPage() {
  const [blends, setBlends] = useState([]);

  useEffect(() => {
    blendService.getBlends().then(setBlends);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Blends</h1>
      {blends.map((blend: any) => (
        <div key={blend.id} className="p-4 border rounded mb-2">
          <p>Blend with User {blend.user2_id}</p>
        </div>
      ))}
    </div>
  );
}
