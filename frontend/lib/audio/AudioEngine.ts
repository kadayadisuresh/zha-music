import { usePlaybackStore, Track } from '../stores/playbackStore';
import { mediaSessionManager } from './MediaSessionManager';
import { initDB } from '../db/idb';

declare global {
  var __audioEngine: AudioEngine | undefined;
}

class AudioEngine {
  private players: HTMLAudioElement[];
  private activeIdx: number = 0;
  private currentVideoId: string | null = null;
  private isProxyFallback: boolean = false;
  private monitorId: number | null = null;
  private prefetchTriggered: boolean = false;
  private transitionTriggered: boolean = false;

  constructor() {
    if (typeof window === 'undefined') {
      this.players = [{} as HTMLAudioElement, {} as HTMLAudioElement]; // Stub for SSR
      return;
    }

    const { volume, isMuted } = usePlaybackStore.getState();
    const vol = typeof volume === 'number' && !isNaN(volume) ? volume : 1.0;
    const muted = !!isMuted;
    this.players = [new Audio(), new Audio()];
    this.players.forEach((player, idx) => {
      player.volume = muted ? 0 : vol;
      this.setupEventListeners(player, idx);
    });

    // Subscribe to store updates to keep player volumes strictly in sync
    usePlaybackStore.subscribe((state) => {
      const currentVol = typeof state.volume === 'number' && !isNaN(state.volume) ? state.volume : 1.0;
      const currentMuted = !!state.isMuted;
      const targetVol = currentMuted ? 0 : currentVol;
      this.players.forEach((p, idx) => {
        if (p.volume !== targetVol) {
          console.log(`[AudioEngine] Syncing player ${idx} volume to store update: ${targetVol}`);
          p.volume = targetVol;
        }
      });
    });

    this.setupMediaSession();
  }

  private safePlay(player: HTMLAudioElement) {
    const idx = this.players.indexOf(player);
    console.log(`[AudioEngine] Calling safePlay() on player ${idx}. src: ${player.src}, volume: ${player.volume}`);
    const playPromise = player.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`[AudioEngine] playPromise resolved successfully for player ${idx}`);
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            console.error(`[AudioEngine] playPromise rejected for player ${idx}:`, error);
          } else {
            console.log(`[AudioEngine] playPromise aborted safely (AbortError) for player ${idx}`);
          }
        });
    } else {
      console.log(`[AudioEngine] playPromise returned undefined for player ${idx} (Legacy synchronous fallback)`);
    }
  }

  private setupMediaSession() {
    mediaSessionManager.setActionHandlers({
      play: () => this.safePlay(this.activePlayer),
      pause: () => this.pause(),
      next: () => this.switchTracks(false),
      prev: () => console.log('MediaSession: Prev track'),
      seek: (time) => this.seek(time)
    });
  }

  private get activePlayer() {
    return this.players[this.activeIdx];
  }

  private get inactivePlayer() {
    return this.players[1 - this.activeIdx];
  }

  private setupEventListeners(player: HTMLAudioElement, idx: number) {
    player.addEventListener('play', () => {
      console.log(`[AudioEngine] Player ${idx} 'play' event fired`);
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setPlaying(true);
        mediaSessionManager.updatePlaybackState('playing');
        this.startMonitor();
      }
    });

    player.addEventListener('pause', () => {
      console.log(`[AudioEngine] Player ${idx} 'pause' event fired`);
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setPlaying(false);
        mediaSessionManager.updatePlaybackState('paused');
        this.stopMonitor();
      }
    });

    player.addEventListener('ended', () => {
      console.log(`[AudioEngine] Player ${idx} 'ended' event fired`);
      if (this.activeIdx === idx && !this.transitionTriggered) {
        const { repeatMode, sleepTimerDuration, setSleepTimer } = usePlaybackStore.getState();
        if (sleepTimerDuration === -1) {
          this.pause();
          setSleepTimer(null);
          return;
        }
        if (repeatMode === 'one') {
          player.currentTime = 0;
          this.safePlay(player);
        } else {
          this.switchTracks(true);
        }
      }
    });

    player.addEventListener('loadedmetadata', () => {
      console.log(`[AudioEngine] Player ${idx} 'loadedmetadata' event fired. Duration: ${player.duration}`);
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setDuration(player.duration);
        usePlaybackStore.getState().setIsLoading(false);
        mediaSessionManager.updatePositionState(player.duration, player.currentTime);
      }
    });

    // Native time/duration updates. Unlike the rAF monitor (which is throttled
    // or paused when the tab/page isn't foregrounded — common on mobile), these
    // media events fire during playback, so the timestamp + progress bar stay
    // in sync even when requestAnimationFrame is not running.
    player.addEventListener('timeupdate', () => {
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setCurrentTime(player.currentTime);
      }
    });

    player.addEventListener('durationchange', () => {
      if (this.activeIdx === idx && !isNaN(player.duration)) {
        usePlaybackStore.getState().setDuration(player.duration);
      }
    });

    player.addEventListener('waiting', () => {
      console.log(`[AudioEngine] Player ${idx} 'waiting' event fired`);
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setIsLoading(true);
      }
    });

    player.addEventListener('playing', () => {
      console.log(`[AudioEngine] Player ${idx} 'playing' event fired`);
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setIsLoading(false);
        mediaSessionManager.updatePlaybackState('playing');
      }
    });

    player.addEventListener('stalled', () => {
      console.warn(`[AudioEngine] Player ${idx} 'stalled' event fired`);
    });

    player.addEventListener('suspend', () => {
      console.log(`[AudioEngine] Player ${idx} 'suspend' event fired`);
    });

    player.addEventListener('error', (e) => {
      const err = player.error;
      console.error(`[AudioEngine] Player ${idx} 'error' event fired. Code: ${err ? err.code : 'unknown'}, Message: ${err ? err.message : 'none'}`, e);
      if (this.activeIdx !== idx) return;
      
      if (!this.isProxyFallback && this.currentVideoId) {
        console.log(`[AudioEngine] Attempting fresh-resolve retry for video: ${this.currentVideoId}`);
        this.playWithProxy(this.currentVideoId);
      } else {
        usePlaybackStore.getState().setIsLoading(false);
        usePlaybackStore.getState().setPlaying(false);
      }
    });
  }

  private startMonitor() {
    if (this.monitorId) return;
    const loop = () => {
      this.monitorPlayback();
      this.monitorId = requestAnimationFrame(loop);
    };
    this.monitorId = requestAnimationFrame(loop);
  }

  private stopMonitor() {
    if (this.monitorId) {
      cancelAnimationFrame(this.monitorId);
      this.monitorId = null;
    }
  }

  private monitorPlayback() {
    const player = this.activePlayer;
    if (!player) return;

    // High precision time updates for UI
    usePlaybackStore.getState().setCurrentTime(player.currentTime);
    mediaSessionManager.updatePositionState(player.duration, player.currentTime);

    // Adaptive Pre-fetch Check
    this.checkPrefetch(player);

    // Gapless Transition Check (200ms before end)
    this.checkTransition(player);
  }

  private checkPrefetch(player: HTMLAudioElement) {
    if (this.prefetchTriggered) return;
    if (!player.duration || isNaN(player.duration)) return;

    const { repeatMode } = usePlaybackStore.getState();
    if (repeatMode === 'one') return;

    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType || '4g';
    const prefetchWindow = (effectiveType === '2g' || effectiveType === 'slow-2g') ? 30 : 10;

    if (player.duration - player.currentTime <= prefetchWindow) {
      const nextTrack = usePlaybackStore.getState().nextTrack;
      if (nextTrack) {
        this.prefetchTriggered = true;
        this.prepareNext(nextTrack);
      }
    }
  }

  private checkTransition(player: HTMLAudioElement) {
    if (this.transitionTriggered) return;
    if (!player.duration || isNaN(player.duration)) return;

    const { repeatMode, crossfadeDuration } = usePlaybackStore.getState();
    if (repeatMode === 'one') return;

    // With crossfade enabled, begin the transition `crossfadeDuration` seconds
    // before the end so the outgoing/incoming songs overlap. Otherwise use the
    // 200ms gapless micro-crossfade right at the end.
    const cf = typeof crossfadeDuration === 'number' ? Math.max(0, Math.min(12, crossfadeDuration)) : 0;
    const triggerWindow = cf > 0 ? cf : 0.2;

    if (player.duration - player.currentTime <= triggerWindow) {
      const nextTrack = usePlaybackStore.getState().nextTrack;
      if (nextTrack) {
        this.transitionTriggered = true;
        this.switchTracks(true);
      }
    }
  }

  async switchTracks(automatic: boolean) {
    const nextTrack = usePlaybackStore.getState().nextTrack;
    if (!nextTrack) {
      console.log('No next track prepared for switch');
      return;
    }

    const outPlayer = this.activePlayer;
    const inPlayer = this.inactivePlayer;

    // The incoming player is normally preloaded by checkPrefetch — but that runs
    // on the rAF monitor, which the browser pauses when the tab/screen isn't
    // foregrounded (common on mobile / locked screen). If preload didn't happen,
    // inPlayer has no (or a stale) src and playing it throws "Empty src
    // attribute", so the track never advances (autoplay appears broken). Ensure
    // it's loaded with nextTrack before switching.
    if (!inPlayer.src || !inPlayer.src.includes(`video_id=${nextTrack.id}`)) {
      await this.prepareNext(nextTrack);
    }

    const { volume, isMuted } = usePlaybackStore.getState();
    const vol = typeof volume === 'number' && !isNaN(volume) ? volume : 1.0;
    const muted = !!isMuted;
    const targetVolume = muted ? 0 : vol;

    if (automatic) {
      // Crossfade over the configured duration (default 200ms gapless micro-fade)
      const { crossfadeDuration } = usePlaybackStore.getState();
      const cf = typeof crossfadeDuration === 'number' ? Math.max(0, Math.min(12, crossfadeDuration)) : 0;
      const fadeTime = cf > 0 ? cf * 1000 : 200;
      const start = performance.now();
      
      inPlayer.volume = 0;
      this.safePlay(inPlayer);

      const fade = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / fadeTime, 1);
        
        outPlayer.volume = targetVolume * (1 - progress);
        inPlayer.volume = targetVolume * progress;

        if (progress < 1) {
          requestAnimationFrame(fade);
        } else {
          this.finalizeSwitch(outPlayer, inPlayer, nextTrack, targetVolume);
        }
      };
      requestAnimationFrame(fade);
    } else {
      // Instant manual switch
      this.finalizeSwitch(outPlayer, inPlayer, nextTrack, targetVolume);
      this.safePlay(inPlayer);
    }
  }

  private finalizeSwitch(outPlayer: HTMLAudioElement, inPlayer: HTMLAudioElement, nextTrack: Track, volume: number) {
    outPlayer.pause();
    outPlayer.src = '';
    const { isMuted } = usePlaybackStore.getState();
    const muted = !!isMuted;
    const vol = typeof volume === 'number' && !isNaN(volume) ? volume : 1.0;
    outPlayer.volume = muted ? 0 : vol; // Reset for future use

    this.activeIdx = 1 - this.activeIdx;
    this.prefetchTriggered = false;
    this.transitionTriggered = false;
    this.currentVideoId = nextTrack.id;

    usePlaybackStore.getState().setTrack(nextTrack);
    usePlaybackStore.getState().setNextTrack(null);
    usePlaybackStore.getState().setDuration(inPlayer.duration);
    mediaSessionManager.updateMetadata(nextTrack);
    // Record the auto-advanced/gapless track as a play
    import('../services/userDataService').then(({ recordPlay }) => recordPlay(nextTrack));
  }

  async play(videoId: string, trackInfo?: Track) {
    const track = trackInfo || { id: videoId, title: 'Loading...', artists: [{ name: 'Unknown' }] };
    console.log(`[AudioEngine] play() called for videoId: ${videoId}, Title: "${track.title}"`);
    
    if (this.currentVideoId === videoId && this.activePlayer.src) {
      console.log(`[AudioEngine] Re-playing currently loaded active player for videoId: ${videoId}`);
      this.safePlay(this.activePlayer);
      return;
    }

    this.currentVideoId = videoId;
    this.isProxyFallback = false;
    this.prefetchTriggered = false;
    this.transitionTriggered = false;
    
    usePlaybackStore.getState().setTrack(track);
    mediaSessionManager.updateMetadata(track);
    
    usePlaybackStore.getState().setIsLoading(true);

    try {
      console.log(`[AudioEngine] Checking IndexedDB offline storage for videoId: ${videoId}`);
      const db = await initDB();
      const downloadedAudio = await db.get('zha-downloads-audio', videoId);
      if (downloadedAudio && downloadedAudio.data) {
        console.log(`[AudioEngine] Found downloaded offline audio in IndexedDB for videoId: ${videoId}`);
        const localUrl = URL.createObjectURL(downloadedAudio.data);
        const { volume, isMuted } = usePlaybackStore.getState();
        const vol = typeof volume === 'number' && !isNaN(volume) ? volume : 1.0;
        const muted = !!isMuted;
        
        console.log(`[AudioEngine] Playing offline blob. activePlayerIdx: ${this.activeIdx}, volume: ${vol}, isMuted: ${muted}, blobUrl: ${localUrl}`);
        this.activePlayer.volume = muted ? 0 : vol;
        this.activePlayer.src = localUrl;
        this.safePlay(this.activePlayer);
        
        const meta = await db.get('zha-downloads-meta', videoId);
        if (meta) {
          db.put('zha-downloads-meta', { ...meta, lastPlayedAt: Date.now() });
        }
        return;
      } else {
        console.log(`[AudioEngine] No offline audio found in IndexedDB for videoId: ${videoId}`);
      }
    } catch (err) {
      console.warn('[AudioEngine] Failed to check offline download storage:', err);
    }

    try {
      // Use the server-side pipe endpoint to stream audio through Next.js
      // This avoids CORS issues with direct googlevideo.com CDN URLs
      const pipeUrl = `/api/innertube/pipe?video_id=${videoId}`;
      console.log(`[AudioEngine] Using pipe URL for videoId: ${videoId}`);

      const { volume, isMuted } = usePlaybackStore.getState();
      const vol = typeof volume === 'number' && !isNaN(volume) ? volume : 1.0;
      const muted = !!isMuted;
      
      console.log(`[AudioEngine] Setting active player src to pipe URL. activePlayerIdx: ${this.activeIdx}, volume: ${vol}, isMuted: ${muted}`);
      this.activePlayer.volume = muted ? 0 : vol;
      this.activePlayer.src = pipeUrl;
      this.safePlay(this.activePlayer);
    } catch (error) {
      console.error(`[AudioEngine] Pipe playback error:`, error);
      this.playWithProxy(videoId);
    }
  }

  // On a playback error, retry through the same youtubei.js pipe but force a
  // fresh resolution (`refresh=1`) in case the cached CDN URL expired. Slice 4
  // replaced the old FastAPI/yt-dlp proxy fallback with this self-contained path.
  private playWithProxy(videoId: string) {
    this.isProxyFallback = true;

    const { volume, isMuted } = usePlaybackStore.getState();
    const vol = typeof volume === 'number' && !isNaN(volume) ? volume : 1.0;
    const muted = !!isMuted;
    const retryUrl = `/api/innertube/pipe?video_id=${videoId}&refresh=1`;

    console.log(`[AudioEngine] Fresh-resolve retry. activePlayerIdx: ${this.activeIdx}, src: ${retryUrl}, volume: ${vol}, isMuted: ${muted}`);
    this.activePlayer.volume = muted ? 0 : vol;
    this.activePlayer.src = retryUrl;
    this.activePlayer.load();
    this.safePlay(this.activePlayer);
  }

  async prepareNext(track: Track) {
    usePlaybackStore.getState().setNextTrack(track);
    
    try {
      const db = await initDB();
      const downloadedAudio = await db.get('zha-downloads-audio', track.id);
      if (downloadedAudio && downloadedAudio.data) {
        console.log('[AudioEngine] Preparing next track from offline database:', track.title);
        const localUrl = URL.createObjectURL(downloadedAudio.data);
        const inactive = this.inactivePlayer;
        inactive.src = localUrl;
        inactive.load();
        inactive.pause();
        return;
      }
    } catch (err) {
      console.warn('[AudioEngine] Failed to check next track in offline downloads database:', err);
    }

    try {
      // Use the pipe endpoint for next track pre-loading
      const pipeUrl = `/api/innertube/pipe?video_id=${track.id}`;
      const inactive = this.inactivePlayer;
      inactive.src = pipeUrl;
      inactive.load();
      inactive.pause();
      console.log('Prepared next track:', track.title);
    } catch (error) {
      console.error('Failed to prepare next track:', error);
    }
  }

  pause() {
    this.activePlayer.pause();
  }

  // Gradually fade the current track to silence over `durationMs`, then pause
  // and restore the volume (used by the sleep timer). Returns when done.
  fadeOutAndPause(durationMs = 3000): Promise<void> {
    return new Promise((resolve) => {
      const player = this.activePlayer;
      const { volume, isMuted } = usePlaybackStore.getState();
      const startVol = isMuted ? 0 : (typeof volume === 'number' && !isNaN(volume) ? volume : 1.0);
      if (!player || startVol === 0) {
        player?.pause();
        resolve();
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - start) / durationMs, 1);
        player.volume = startVol * (1 - progress);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          player.pause();
          player.volume = startVol; // restore for next play
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  seek(time: number) {
    this.activePlayer.currentTime = time;
    // Reflect the new position immediately so the UI updates even when paused
    // (the monitor rAF loop only runs during playback).
    usePlaybackStore.getState().setCurrentTime(time);
  }

  setVolume(val: number) {
    const { isMuted } = usePlaybackStore.getState();
    const vol = typeof val === 'number' && !isNaN(val) ? val : 1.0;
    const muted = !!isMuted;
    this.players.forEach(p => p.volume = muted ? 0 : vol);
    usePlaybackStore.getState().setVolume(vol);
  }

  setMuted(muted: boolean) {
    const { volume } = usePlaybackStore.getState();
    let vol = typeof volume === 'number' && !isNaN(volume) ? volume : 1.0;
    const isMuted = !!muted;
    
    // If unmuting and volume is 0, raise it to an audible level
    if (!isMuted && vol === 0) {
      vol = 0.3;
      usePlaybackStore.getState().setVolume(vol);
    }

    this.players.forEach(p => p.volume = isMuted ? 0 : vol);
    usePlaybackStore.getState().setIsMuted(isMuted);
  }

  getAudioElement() {
    return this.activePlayer;
  }
}

// Singleton pattern with HMR safety
let audioEngine: AudioEngine;

if (typeof window !== 'undefined') {
  if (!globalThis.__audioEngine) {
    globalThis.__audioEngine = new AudioEngine();
  }
  audioEngine = globalThis.__audioEngine;
} else {
  audioEngine = new AudioEngine();
}

export { audioEngine };
