import { useState, useEffect } from 'react';

export function useAdaptiveColor(imageUrl: string | null | undefined) {
  const [color, setColor] = useState<string>('#000000');

  useEffect(() => {
    if (!imageUrl) {
      setColor('#000000');
      return;
    }

    const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(imageUrl)}`;

    async function fetchColor() {
      try {
        const response = await fetch(proxyUrl, { method: 'HEAD' });
        const dominantColor = response.headers.get('X-Dominant-Color');
        if (dominantColor) {
          setColor(dominantColor);
        }
      } catch (error) {
        console.error('[useAdaptiveColor] Failed to fetch color:', error);
      }
    }

    fetchColor();
  }, [imageUrl]);

  return color;
}
