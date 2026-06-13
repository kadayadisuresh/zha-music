'use client';

import React, { useEffect, useState } from 'react';
import { Download, Play, Trash2, HardDrive } from 'lucide-react';
import { useDownloadStore } from '@/lib/stores/downloadStore';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { TrackItem } from '@/components/shared/TrackItem';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { getQuotaInfo } from '@/lib/db/idb';

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function DownloadsPage() {
  const { downloadedTracks, loadDownloads, deleteDownload, initialize } = useDownloadStore();
  const { playTrack, setQueue } = usePlaybackStore();
  const [quota, setQuota] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });

  useEffect(() => {
    initialize();
    loadDownloads();

    getQuotaInfo().then((info) => {
      setQuota({
        usage: info.usage || 0,
        quota: info.quota || 0,
      });
    });
  }, [initialize, loadDownloads]);

  const handlePlayAll = () => {
    if (downloadedTracks.length > 0) {
      setQueue(downloadedTracks);
      playTrack(downloadedTracks[0]);
    }
  };

  const usagePercent = quota.quota > 0 ? (quota.usage / quota.quota) * 100 : 0;

  return (
    <div className="p-8 max-w-screen-2xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-8 text-center md:text-left">
        <div className="w-40 h-40 bg-gradient-to-br from-zinc-700 to-zinc-950 rounded-2xl shadow-2xl flex items-center justify-center relative group overflow-hidden border border-zinc-800">
          <Download className="w-16 h-16 text-white group-hover:scale-110 transition-transform duration-300" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={handlePlayAll}>
            <Play className="w-12 h-12 text-white fill-current" />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-2">Library</p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-white">Downloads</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-zinc-400 text-sm justify-center md:justify-start">
            <span>{downloadedTracks.length} {downloadedTracks.length === 1 ? 'song' : 'songs'}</span>
            {quota.quota > 0 && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="flex items-center gap-1">
                  <HardDrive size={14} />
                  {formatBytes(quota.usage)} used of {formatBytes(quota.quota)}
                </span>
              </>
            )}
          </div>
        </div>
        {downloadedTracks.length > 0 && (
          <Button 
            onClick={handlePlayAll}
            className="bg-[#2E7DF7] hover:bg-[#1F5FD0] text-white font-bold px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
          >
            <Play size={18} fill="currentColor" />
            <span>Play All</span>
          </Button>
        )}
      </div>

      {quota.quota > 0 && (
        <div className="mb-8 max-w-md bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/80">
          <div className="flex justify-between text-xs text-zinc-400 mb-2">
            <span>Offline storage usage</span>
            <span>{usagePercent.toFixed(2)}%</span>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-green-500 h-full rounded-full" style={{ width: `${usagePercent}%` }} />
          </div>
        </div>
      )}
      
      {downloadedTracks.length === 0 ? (
        <EmptyState 
          icon={<Download className="w-12 h-12 text-zinc-600" />} 
          title="No downloaded music" 
          description="Downloads will appear here once you download tracks for offline listening." 
        />
      ) : (
        <div className="space-y-1">
          {downloadedTracks.map((track, index) => (
            <div key={`${track.id}-${index}`} className="flex items-center justify-between group rounded-md hover:bg-zinc-800/20 pr-4">
              <div className="flex-1">
                <TrackItem 
                  track={track} 
                  index={index + 1}
                  onClick={() => {
                    setQueue(downloadedTracks);
                    playTrack(track);
                  }} 
                />
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteDownload(track.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 rounded-full hover:bg-zinc-800 transition-all duration-200"
                title="Delete download"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
