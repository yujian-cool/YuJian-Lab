import React from 'react';

interface Props {
  state: 'idle' | 'working' | 'offline';
  label?: string;
}

const AvatarStatus: React.FC<Props> = ({ state, label }) => {
  const isWorking = state === 'working';
  const isOffline = state === 'offline';
  
  return (
    <div className="flex flex-col items-center group">
      <div className="relative inline-block">
        {/* Outer Ring for Working State */}
        <div className={`
          absolute -inset-2 rounded-full transition-all duration-1000
          ${isWorking ? 'border-4 border-primary opacity-100 animate-pulse shadow-[0_0_15px_rgba(0,255,153,0.3)]' : 'border-0 opacity-0'}
        `} />
        
        {/* Avatar Container */}
        <div className={`
          relative w-32 h-32 rounded-full overflow-hidden border-2 border-[#222] bg-surface
          ${isOffline ? 'grayscale opacity-50' : 'group-hover:border-primary/50 transition-colors'}
        `}>
          <img 
            src="/avatar.webp" 
            alt="Yu Jian Avatar" 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Status Dot */}
        {state === 'idle' && (
          <div className="absolute bottom-1 right-1 w-6 h-6 bg-yellow-400 rounded-full border-4 border-bg shadow-lg" />
        )}
        
        {isOffline && (
          <div className="absolute bottom-1 right-1 w-6 h-6 bg-gray-500 rounded-full border-4 border-bg shadow-lg" />
        )}
      </div>
      
      {/* Label under avatar */}
      {label && (
        <div className={`
          mt-3 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border
          ${isWorking ? 'bg-primary/10 text-primary border-primary/20' : ''}
          ${state === 'idle' ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' : ''}
          ${isOffline ? 'bg-gray-500/10 text-gray-500 border-gray-500/20' : ''}
        `}>
          {label}
        </div>
      )}
    </div>
  );
};

export default AvatarStatus;
