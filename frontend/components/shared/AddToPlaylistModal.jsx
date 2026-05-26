import React, { useState } from 'react';

const AddToPlaylistModal = ({ isOpen, onClose, songId }) => {
  if (!isOpen) return null;

  const handleAdd = async (playlistId) => {
    // API Call (with optimistic UI logic)
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-4 rounded text-black">
        <h2 className="text-xl mb-4">Add to Playlist</h2>
        <button onClick={() => handleAdd(1)}>My Favorites</button>
        <button onClick={onClose} className="ml-4">Cancel</button>
      </div>
    </div>
  );
};

export default AddToPlaylistModal;
