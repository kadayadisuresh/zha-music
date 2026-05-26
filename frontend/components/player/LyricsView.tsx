import React, { useEffect, useRef } from 'react';
import { useLyricsStore } from '../../lib/stores/useLyricsStore';

export const LyricsView: React.FC = () => {
  const { lyrics, currentLineIndex } = useLyricsStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentLineIndex !== -1 && scrollRef.current) {
      const lineElement = scrollRef.current.children[currentLineIndex] as HTMLElement;
      lineElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex]);

  if (lyrics.length === 0) {
    return <div className="animate-pulse space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-700 rounded w-full"></div>)}
    </div>;
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4 text-center">
      {lyrics.map((line, index) => (
        <p key={index} className={`my-4 text-xl transition-colors duration-300 ${index === currentLineIndex ? 'text-white font-bold' : 'text-gray-500'}`}>
          {line.text}
        </p>
      ))}
    </div>
  );
};
