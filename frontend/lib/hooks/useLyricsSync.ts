import { useEffect } from 'react';
import { useLyricsStore } from '../stores/useLyricsStore';

export const useLyricsSync = (currentTime: number) => {
  const { lyrics, setCurrentLineIndex, offset } = useLyricsStore();

  useEffect(() => {
    const adjustedTime = currentTime + offset;
    
    // Find current line based on adjusted time
    let foundIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (adjustedTime >= lyrics[i].startTime) {
            foundIndex = i;
        } else {
            break;
        }
    }
    
    if (foundIndex !== -1) {
        setCurrentLineIndex(foundIndex);
    }
  }, [currentTime, lyrics, offset, setCurrentLineIndex]);
};
