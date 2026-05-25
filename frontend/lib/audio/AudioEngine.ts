import { usePlaybackStore, Track } from '../stores/playbackStore';
import { mediaSessionManager } from './MediaSessionManager';

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

    this.players = [new Audio(), new Audio()];
    this.players.forEach((player, idx) => {
      player.crossOrigin = 'anonymous';
      this.setupEventListeners(player, idx);
    });

    this.setupMediaSession();
  }

  private setupMediaSession() {
    mediaSessionManager.setActionHandlers({
      play: () => this.activePlayer.play(),
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
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setPlaying(true);
        mediaSessionManager.updatePlaybackState('playing');
        this.startMonitor();
      }
    });

    player.addEventListener('pause', () => {
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setPlaying(false);
        mediaSessionManager.updatePlaybackState('paused');
        this.stopMonitor();
      }
    });

    player.addEventListener('ended', () => {
      if (this.activeIdx === idx && !this.transitionTriggered) {
        this.switchTracks(true);
      }
    });

    player.addEventListener('loadedmetadata', () => {
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setDuration(player.duration);
        usePlaybackStore.getState().setIsLoading(false);
        mediaSessionManager.updatePositionState(player.duration, player.currentTime);
      }
    });

    player.addEventListener('waiting', () => {
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setIsLoading(true);
      }
    });

    player.addEventListener('playing', () => {
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setIsLoading(false);
        mediaSessionManager.updatePlaybackState('playing');
      }
    });

    player.addEventListener('error', (e) => {
      if (this.activeIdx !== idx) return;

      console.error('Audio element error:', e);
      
      if (!this.isProxyFallback && this.currentVideoId) {
        console.log('Attempting proxy fallback for video:', this.currentVideoId);
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

    // Trigger switch 200ms before end for gapless
    if (player.duration - player.currentTime <= 0.2) {
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
    const targetVolume = usePlaybackStore.getState().volume;

    if (automatic) {
      // 200ms Micro-crossfade
      const fadeTime = 200;
      const start = performance.now();
      
      inPlayer.volume = 0;
      inPlayer.play();

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
      inPlayer.play();
    }
  }

  private finalizeSwitch(outPlayer: HTMLAudioElement, inPlayer: HTMLAudioElement, nextTrack: Track, volume: number) {
    outPlayer.pause();
    outPlayer.src = '';
    outPlayer.volume = volume; // Reset for future use

    this.activeIdx = 1 - this.activeIdx;
    this.prefetchTriggered = false;
    this.transitionTriggered = false;
    this.currentVideoId = nextTrack.id;

    usePlaybackStore.getState().setTrack(nextTrack);
    usePlaybackStore.getState().setNextTrack(null);
    usePlaybackStore.getState().setDuration(inPlayer.duration);
    mediaSessionManager.updateMetadata(nextTrack);
  }

  async play(videoId: string, trackInfo?: Track) {
    if (this.currentVideoId === videoId && this.activePlayer.src) {
      this.activePlayer.play();
      return;
    }

    this.currentVideoId = videoId;
    this.isProxyFallback = false;
    this.prefetchTriggered = false;
    this.transitionTriggered = false;
    
    const track = trackInfo || { id: videoId, title: 'Loading...', artist: '' };
    usePlaybackStore.getState().setTrack(track);
    mediaSessionManager.updateMetadata(track);
    
    usePlaybackStore.getState().setIsLoading(true);

    try {
      const response = await fetch(`/api/innertube/stream?video_id=${videoId}`);
      if (!response.ok) throw new Error('Failed to fetch stream URL');
      
      const data = await response.json();
      if (!data.url) throw new Error('No stream URL returned');

      this.activePlayer.src = data.url;
      this.activePlayer.play();
    } catch (error) {
      console.error('Stream fetch error:', error);
      // If direct fetch fails, try proxy immediately
      this.playWithProxy(videoId);
    }
  }

  private playWithProxy(videoId: string) {
    this.isProxyFallback = true;
    this.activePlayer.src = `/api/audio/proxy/${videoId}`;
    this.activePlayer.load();
    this.activePlayer.play();
  }

  async prepareNext(track: Track) {
    usePlaybackStore.getState().setNextTrack(track);
    
    try {
      const response = await fetch(`/api/innertube/stream?video_id=${track.id}`);
      if (!response.ok) throw new Error('Failed to fetch stream URL');
      
      const data = await response.json();
      if (!data.url) throw new Error('No stream URL returned');

      const inactive = this.inactivePlayer;
      inactive.src = data.url;
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

  seek(time: number) {
    this.activePlayer.currentTime = time;
  }

  setVolume(val: number) {
    this.players.forEach(p => p.volume = val);
    usePlaybackStore.getState().setVolume(val);
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
