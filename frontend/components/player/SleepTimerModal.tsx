"use client";

import React from 'react';
import { X, Clock } from 'lucide-react';
import { usePlaybackStore } from '@/lib/stores/playbackStore';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const { sleepTimerDuration, setSleepTimer } = usePlaybackStore();

  if (!isOpen) return null;

  const options = [
    { label: 'Off', value: null },
    { label: '5 minutes', value: 5 },
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '45 minutes', value: 45 },
    { label: '60 minutes', value: 60 },
    { label: 'End of track', value: -1 }
  ];

  const handleSelect = (val: number | null) => {
    setSleepTimer(val);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Clock size={20} className="text-red-500" />
            <span>Sleep Timer</span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-1">
          {options.map((opt) => {
            const isSelected = sleepTimerDuration === opt.value;
            return (
              <button
                type="button"
                key={opt.label}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-between text-sm ${
                  isSelected 
                    ? 'bg-red-500/10 text-red-500 font-semibold' 
                    : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
