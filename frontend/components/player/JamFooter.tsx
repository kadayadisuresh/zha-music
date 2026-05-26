import React from 'react';

export const JamFooter: React.FC<{ isHost: boolean }> = ({ isHost }) => {
  return (
    <div className="jam-footer-indicator" style={{ display: 'flex', alignItems: 'center', padding: '10px', background: '#333', color: '#fff' }}>
      <div className="pulsing-indicator" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'red', marginRight: '10px' }}></div>
      <span>{isHost ? 'Host' : 'Guest'} Jam Session</span>
    </div>
  );
};
