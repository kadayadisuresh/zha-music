"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useLyricsStore } from '../../lib/stores/useLyricsStore';
import { usePlaybackStore } from '../../lib/stores/playbackStore';
import { useLyricsSync } from '../../lib/hooks/useLyricsSync';
import { parseLyrics } from '../../lib/utils/lyricsParser';
import { audioEngine } from '../../lib/audio/AudioEngine';

export const LyricsView: React.FC = () => {
  const { currentTrack, currentTime } = usePlaybackStore();
  const { lyrics, setLyrics, currentLineIndex, offset, setOffset } = useLyricsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync lyrics index as time progresses
  useLyricsSync(currentTime);

  useEffect(() => {
    if (currentLineIndex !== -1 && scrollRef.current) {
      const lineElement = scrollRef.current.children[currentLineIndex] as HTMLElement;
      lineElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex]);

  useEffect(() => {
    if (!currentTrack) {
      setLyrics([]);
      return;
    }

    const fetchLyrics = async () => {
      setIsLoading(true);
      setError(null);
      setLyrics([]); // Clear old lyrics
      try {
        const title = currentTrack.title;
        const artist = currentTrack.artists.map(a => a.name).join(', ');
        const trackDuration = currentTrack.duration ? Math.round(currentTrack.duration) : null;

        let data: any = null;

        // Strategy 1: Try /api/get with duration if available (exact match)
        if (trackDuration) {
          const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}&duration=${trackDuration}`;
          const getRes = await fetch(getUrl);
          if (getRes.ok) {
            const getData = await getRes.json();
            if (getData && (getData.syncedLyrics || getData.plainLyrics)) {
              data = getData;
            }
          }
        }

        // Strategy 2: Fallback to /api/search (returns array, pick best match)
        if (!data) {
          const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
          const searchRes = await fetch(searchUrl);
          if (!searchRes.ok) {
            throw new Error('No lyrics found');
          }
          const results = await searchRes.json();
          if (!Array.isArray(results) || results.length === 0) {
            throw new Error('No lyrics found');
          }

          // Prefer results with synced lyrics, then pick closest duration match
          const withSynced = results.filter((r: any) => r.syncedLyrics);
          const candidates = withSynced.length > 0 ? withSynced : results;

          if (trackDuration) {
            // Sort by closest duration
            candidates.sort((a: any, b: any) =>
              Math.abs((a.duration || 0) - trackDuration) - Math.abs((b.duration || 0) - trackDuration)
            );
          }
          data = candidates[0];
        }

        if (!data) {
          throw new Error('No lyrics found');
        }

        const rawLrc = data.syncedLyrics || data.plainLyrics || '';

        if (!rawLrc) {
          throw new Error('Lyrics content is empty');
        }

        if (data.syncedLyrics) {
          const parsed = parseLyrics(data.syncedLyrics);
          setLyrics(parsed);
          setIsSynced(true);
        } else {
          // If only plain lyrics exist, format them with dummy timestamps
          const lines = data.plainLyrics.split('\n').map((line: string, idx: number) => ({
            startTime: idx * 4, // dummy timing
            text: line.trim()
          }));
          setLyrics(lines);
          setIsSynced(false);
        }
      } catch (err: any) {
        setError('Lyrics are not available for this track yet.');
        setLyrics([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLyrics();
  }, [currentTrack, setLyrics]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 space-y-4 text-center">
        <p className="text-zinc-400 animate-pulse">Searching lyrics on LRCLIB...</p>
        <div className="animate-pulse space-y-4 w-full max-w-xs">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-zinc-800 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || lyrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-white/45 text-center">
        <p>{error || 'Lyrics are not available for this track yet.'}</p>
      </div>
    );
  }

  const handleLineClick = (startTime: number) => {
    if (!isSynced) return;
    audioEngine.seek(Math.max(0, startTime - offset));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Offset adjustment (synced lyrics only) */}
      {isSynced && (
        <div className="flex items-center justify-center gap-3 pb-3 text-xs text-zinc-400 shrink-0">
          <span className="uppercase tracking-wider">Sync</span>
          <button
            type="button"
            onClick={() => setOffset(Number((offset - 0.5).toFixed(1)))}
            aria-label="Lyrics earlier"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="tabular-nums w-12 text-center text-white">
            {offset > 0 ? '+' : ''}{offset.toFixed(1)}s
          </span>
          <button
            type="button"
            onClick={() => setOffset(Number((offset + 0.5).toFixed(1)))}
            aria-label="Lyrics later"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors"
          >
            <Plus size={14} />
          </button>
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 text-center select-none">
        {lyrics.map((line, index) => (
          <p
            key={index}
            onClick={() => handleLineClick(line.startTime)}
            className={`my-4 text-xl transition-colors duration-300 ${
              isSynced ? 'cursor-pointer hover:text-white/80' : ''
            } ${
              index === currentLineIndex ? 'text-white font-bold scale-105 duration-200' : 'text-zinc-500'
            }`}
          >
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
};
