import React from 'react';

interface MobileControlsProps {
  onDirectionPress: (direction: string | null) => void;
  onAttackPress: () => void;
}

const MobileControls: React.FC<MobileControlsProps> = ({ onDirectionPress, onAttackPress }) => {
  return (
    <div className="fixed bottom-6 left-0 right-0 p-4 flex justify-between items-center md:hidden pointer-events-auto z-30 select-none touch-manipulation">
      {/* D-Pad Controls */}
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        {/* Empty top-left */}
        <div className="w-12 h-12"></div>
        {/* Up button */}
        <button
          className="w-12 h-12 bg-gray-800/70 rounded-md flex items-center justify-center text-white select-none touch-manipulation z-30"
          onPointerDown={() => onDirectionPress('up')}
          onPointerUp={() => onDirectionPress(null)}
          onPointerLeave={() => onDirectionPress(null)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        {/* Empty top-right */}
        <div className="w-12 h-12"></div>
        
        {/* Left button */}
        <button
          className="w-12 h-12 bg-gray-800/70 rounded-md flex items-center justify-center text-white select-none touch-manipulation z-30"
          onPointerDown={() => onDirectionPress('left')}
          onPointerUp={() => onDirectionPress(null)}
          onPointerLeave={() => onDirectionPress(null)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {/* Center (empty) */}
        <div className="w-12 h-12"></div>
        {/* Right button */}
        <button
          className="w-12 h-12 bg-gray-800/70 rounded-md flex items-center justify-center text-white select-none touch-manipulation z-30"
          onPointerDown={() => onDirectionPress('right')}
          onPointerUp={() => onDirectionPress(null)}
          onPointerLeave={() => onDirectionPress(null)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        {/* Empty bottom-left */}
        <div className="w-12 h-12"></div>
        {/* Down button */}
        <button
          className="w-12 h-12 bg-gray-800/70 rounded-md flex items-center justify-center text-white select-none touch-manipulation z-30"
          onPointerDown={() => onDirectionPress('down')}
          onPointerUp={() => onDirectionPress(null)}
          onPointerLeave={() => onDirectionPress(null)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {/* Empty bottom-right */}
        <div className="w-12 h-12"></div>
      </div>
      
      {/* Attack Button */}
      <button
        className="w-16 h-16 bg-red-600/70 rounded-full flex items-center justify-center text-white select-none touch-manipulation z-30"
        onPointerDown={(e) => {
          e.preventDefault();
          onAttackPress();
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </button>
    </div>
  );
};

export default MobileControls;
