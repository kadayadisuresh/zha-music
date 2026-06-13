"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Settings as SettingsIcon } from "lucide-react";
import { usePlaybackStore } from "@/lib/stores/playbackStore";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    crossfadeDuration,
    setCrossfadeDuration,
    autoplayEnabled,
    toggleAutoplay,
    autoCleanupEnabled,
    toggleAutoCleanup,
  } = usePlaybackStore();

  // Only portal after mount (document is available client-side)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  // Render into document.body so the fixed overlay is positioned relative to
  // the viewport — not trapped by the navbar's backdrop-filter containing block.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <SettingsIcon size={20} className="text-[#2E7DF7]" />
            <span>Settings</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Crossfade */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="crossfade" className="text-sm font-semibold text-white">
                Crossfade
              </label>
              <span className="text-sm text-[#2E7DF7] font-mono">
                {crossfadeDuration === 0 ? "Off" : `${crossfadeDuration}s`}
              </span>
            </div>
            <input
              id="crossfade"
              type="range"
              min="0"
              max="12"
              step="1"
              value={crossfadeDuration}
              onChange={(e) => setCrossfadeDuration(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#2E7DF7]"
            />
            <p className="text-xs text-zinc-500 mt-2">
              Fade between songs. 0 seconds = gapless only.
            </p>
          </div>

          {/* Autoplay */}
          <SettingToggle
            label="Autoplay"
            description="Keep playing related songs when the queue ends."
            enabled={autoplayEnabled}
            onToggle={toggleAutoplay}
          />

          {/* Auto-cleanup */}
          <SettingToggle
            label="Auto-clean downloads"
            description="Delete downloaded songs not played in 30 days."
            enabled={autoCleanupEnabled}
            onToggle={toggleAutoCleanup}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

interface SettingToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ label, description, enabled, onToggle }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        enabled ? "bg-[#2E7DF7]" : "bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
          enabled ? "translate-x-5 bg-black" : "translate-x-0 bg-zinc-400"
        }`}
      />
    </button>
  </div>
);
