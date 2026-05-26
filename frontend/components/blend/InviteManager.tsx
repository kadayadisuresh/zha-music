'use client';
import { useState } from 'react';
import { blendService } from '@/lib/services/blendService';

export default function InviteManager() {
  const [userId, setUserId] = useState('');

  const handleInvite = async () => {
    await blendService.sendInvite(parseInt(userId));
    alert('Invite sent!');
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl mb-2">Invite User</h2>
      <input 
        type="text" 
        value={userId} 
        onChange={(e) => setUserId(e.target.value)}
        className="border p-2 mr-2"
        placeholder="User ID"
      />
      <button onClick={handleInvite} className="bg-blue-500 text-white p-2 rounded">
        Send Invite
      </button>
    </div>
  );
}
