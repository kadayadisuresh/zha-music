import React from 'react';

const TrackContextMenu = ({ x, y, onClose, songId, onAddToPlaylist }) => {
  return (
    <div 
      className="absolute bg-gray-800 text-white p-2 rounded shadow-lg"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="cursor-pointer hover:bg-gray-700 p-1"
        onClick={() => { onAddToPlaylist(songId); onClose(); }}
      >
        Add to Playlist
      </div>
      <div className="cursor-pointer hover:bg-gray-700 p-1">Share</div>
    </div>
  );
};

export default TrackContextMenu;
