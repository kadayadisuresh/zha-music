'use client';

import React from 'react';

interface AdaptiveBackgroundProps {
  color: string;
}

export const AdaptiveBackground: React.FC<AdaptiveBackgroundProps> = ({ color }) => {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      <div 
        className="absolute inset-0 transition-colors duration-500 ease-in-out"
        style={{ 
          backgroundColor: color,
          opacity: 0.3,
        }}
      />
      <div 
        className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black"
      />
    </div>
  );
};
