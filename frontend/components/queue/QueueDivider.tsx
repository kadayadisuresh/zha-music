import React from 'react';

interface QueueDividerProps {
  onClearAutoplay: () => void;
  autoplayEnabled: boolean;
  onToggleAutoplay: () => void;
}

export const QueueDivider: React.FC<QueueDividerProps> = ({ 
  onClearAutoplay, 
  autoplayEnabled, 
  onToggleAutoplay 
}) => {
  return (
    <div className="flex items-center justify-between py-4 px-2 border-t border-b border-zinc-800 bg-zinc-900/50">
      <span className="text-sm font-semibold text-zinc-400">Up Next (Autoplay)</span>
      <div className="flex items-center gap-2">
        <button 
          onClick={onToggleAutoplay}
          className={`px-2 py-1 text-xs rounded ${autoplayEnabled ? 'bg-zinc-700' : 'bg-zinc-800'}`}
        >
          {autoplayEnabled ? 'On' : 'Off'}
        </button>
        <button 
          onClick={onClearAutoplay}
          className="px-2 py-1 text-xs bg-red-900/20 text-red-400 rounded hover:bg-red-900/40"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
