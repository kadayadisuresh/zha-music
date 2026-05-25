import { usePlaybackStore, Track } from '../stores/playbackStore';

declare global {
  var __audioEngine: AudioEngine | undefined;
}

class AudioEngine {
  private audio: HTMLAudioElement;
  private currentVideoId: string | null = null;
  private isProxyFallback: boolean = false;

  constructor() {
    if (typeof window === 'undefined') {
      this.audio = {} as HTMLAudioElement; // Stub for SSR
      return;
    }

    this.audio = new Audio();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.audio.addEventListener('play', () => {
      usePlaybackStore.getState().setPlaying(true);
    });

    this.audio.addEventListener('pause', () => {
      usePlaybackStore.getState().setPlaying(false);
    });

    this.audio.addEventListener('timeupdate', () => {
      usePlaybackStore.getState().setCurrentTime(this.audio.currentTime);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      usePlaybackStore.getState().setDuration(this.audio.duration);
      usePlaybackStore.getState().setIsLoading(false);
    });

    this.audio.addEventListener('waiting', () => {
      usePlaybackStore.getState().setIsLoading(true);
    });

    this.audio.addEventListener('playing', () => {
      usePlaybackStore.getState().setIsLoading(false);
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio element error:', e);
      const error = this.audio.error;
      
      // If we haven't tried proxy yet and it's a 403-like error (MEDIA_ERR_SRC_NOT_SUPPORTED or MEDIA_ERR_NETWORK)
      // or if we detect it's a 403 from the network tab (which we can't easily do from JS, 
      // but we can try fallback on any significant error)
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
    if (this.currentVideoId === videoId && this.audio.src) {
      this.audio.play();
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

      this.audio.src = data.url;
      this.audio.play();
    } catch (error) {
      console.error('Stream fetch error:', error);
      // If direct fetch fails, try proxy immediately
      this.playWithProxy(videoId);
    }
  }

  private playWithProxy(videoId: string) {
    this.isProxyFallback = true;
    // We use the direct backend URL since Next.js rewrites /api to backend
    // Or we can use relative path which Next.js will handle
    this.audio.src = `/api/audio/proxy/${videoId}`;
    this.audio.load();
    this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  seek(time: number) {
    this.audio.currentTime = time;
  }

  setVolume(val: number) {
    this.audio.volume = val;
    usePlaybackStore.getState().setVolume(val);
  }

  getAudioElement() {
    return this.audio;
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
