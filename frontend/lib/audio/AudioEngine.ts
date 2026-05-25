import { usePlaybackStore, Track } from '../stores/playbackStore';

declare global {
  var __audioEngine: AudioEngine | undefined;
}

class AudioEngine {
  private players: HTMLAudioElement[];
  private activeIdx: number = 0;
  private currentVideoId: string | null = null;
  private isProxyFallback: boolean = false;

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
      }
    });

    player.addEventListener('pause', () => {
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setPlaying(false);
      }
    });

    player.addEventListener('timeupdate', () => {
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setCurrentTime(player.currentTime);
      }
    });

    player.addEventListener('loadedmetadata', () => {
      if (this.activeIdx === idx) {
        usePlaybackStore.getState().setDuration(player.duration);
        usePlaybackStore.getState().setIsLoading(false);
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

  async play(videoId: string, trackInfo?: Track) {
    if (this.currentVideoId === videoId && this.activePlayer.src) {
      this.activePlayer.play();
      return;
    }

    this.currentVideoId = videoId;
    this.isProxyFallback = false;
    
    if (trackInfo) {
      usePlaybackStore.getState().setTrack(trackInfo);
    } else {
      usePlaybackStore.getState().setTrack({ id: videoId, title: 'Loading...', artist: '' });
    }
    
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
