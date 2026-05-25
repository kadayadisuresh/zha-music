import { Track } from '../stores/playbackStore';

class MediaSessionManager {
  private isSupported: boolean;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'mediaSession' in navigator;
  }

  updateMetadata(track: Track) {
    if (!this.isSupported) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album?.name || 'ZHA Better',
      artwork: track.thumbnail ? [
        { src: track.thumbnail, sizes: '96x96', type: 'image/png' },
        { src: track.thumbnail, sizes: '128x128', type: 'image/png' },
        { src: track.thumbnail, sizes: '192x192', type: 'image/png' },
        { src: track.thumbnail, sizes: '256x256', type: 'image/png' },
        { src: track.thumbnail, sizes: '384x384', type: 'image/png' },
        { src: track.thumbnail, sizes: '512x512', type: 'image/png' },
      ] : []
    });
  }

  updatePlaybackState(state: 'playing' | 'paused') {
    if (!this.isSupported) return;
    navigator.mediaSession.playbackState = state === 'playing' ? 'playing' : 'paused';
  }

  updatePositionState(duration: number, currentTime: number) {
    if (!this.isSupported || isNaN(duration) || isNaN(currentTime)) return;
    
    // Duration must be positive and currentTime must be within [0, duration]
    const validDuration = Math.max(0, duration);
    const validTime = Math.min(validDuration, Math.max(0, currentTime));

    try {
      navigator.mediaSession.setPositionState({
        duration: validDuration,
        playbackRate: 1.0,
        position: validTime
      });
    } catch (error) {
      console.error('Error updating media session position state:', error);
    }
  }

  setActionHandlers(callbacks: {
    play: () => void;
    pause: () => void;
    next?: () => void;
    prev?: () => void;
    seek?: (time: number) => void;
  }) {
    if (!this.isSupported) return;

    const handlers: { action: MediaSessionAction; handler: MediaSessionActionHandler }[] = [
      { action: 'play', handler: callbacks.play },
      { action: 'pause', handler: callbacks.pause },
    ];

    if (callbacks.next) handlers.push({ action: 'nexttrack', handler: callbacks.next });
    if (callbacks.prev) handlers.push({ action: 'previoustrack', handler: callbacks.prev });
    if (callbacks.seek) {
      handlers.push({ 
        action: 'seekto', 
        handler: (details) => {
          if (details.seekTime !== undefined) {
            callbacks.seek!(details.seekTime);
          }
        } 
      });
    }

    handlers.forEach(({ action, handler }) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.warn(`Media Session action "${action}" is not supported in this browser.`);
      }
    });
  }
}

export const mediaSessionManager = new MediaSessionManager();
