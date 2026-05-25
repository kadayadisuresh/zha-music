'use client';

import { useUIStore } from '@/lib/stores/uiStore';
import { usePlaybackStore } from '@/lib/stores/playbackStore';
import { useAdaptiveColor } from '@/lib/hooks/useAdaptiveColor';
import { AdaptiveBackground } from '@/components/ui/AdaptiveBackground';

export const AppBackground = () => {
  const activeThumbnail = useUIStore((state) => state.activeThumbnail);
  const currentTrackThumbnail = usePlaybackStore((state) => state.currentTrack?.thumbnail);
  
  // Priority: Page-specific thumbnail > Playing track thumbnail
  const thumbnail = activeThumbnail || currentTrackThumbnail;
  const color = useAdaptiveColor(thumbnail);

  return <AdaptiveBackground color={color} />;
};
