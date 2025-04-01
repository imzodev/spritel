import React, { useState, useEffect, useRef } from 'react';

interface WelcomeScreenProps {
  onStart: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [characterClass, setCharacterClass] = useState('warrior');
  const [playerName, setPlayerName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Reference to the name input field for auto-focus
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Animated background effect
  const [bgPosition, setBgPosition] = useState({ x: 0, y: 0 });
  
  // Auto-focus on the name input field when component mounts
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  // Handle form submission with Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleStartGame();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 10;
      const y = (e.clientY / window.innerHeight) * 10;
      setBgPosition({ x, y });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleStartGame = () => {
    if (!playerName.trim()) {
      setNameError('Please enter a character name');
      return;
    }
    
    setNameError('');
    setIsLoading(true);
    setFadeOut(true);
    
    // Simulate loading time
    setTimeout(() => {
      onStart();
    }, 1000);
  };

  const classDescriptions = {
    warrior: "Masters of close combat with high health and defense.",
    mage: "Powerful spellcasters with devastating area attacks.",
    rogue: "Swift and stealthy with critical strike abilities.",
    healer: "Support class with healing powers and protective buffs."
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900 transition-opacity duration-1000 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ 
        backgroundPosition: `${bgPosition.x}px ${bgPosition.y}px`,
        backgroundSize: 'cover'
      }}
    >
      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div 
            key={i}
            className="absolute bg-white opacity-20 rounded-full"
            style={{
              width: `${Math.random() * 10 + 5}px`,
              height: `${Math.random() * 10 + 5}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${Math.random() * 10 + 10}s linear infinite`
            }}
          />
        ))}
      </div>
      
      <div className="container max-w-4xl mx-auto px-4 relative z-10">
        {/* Game Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 mb-2 animate-pulse">
            SPRITEL
          </h1>
          <p className="text-xl text-blue-200 italic">
            An Epic MMO Adventure
          </p>
        </div>
        
        {/* Main Content Container */}
        <div className="bg-gray-900 bg-opacity-80 rounded-lg shadow-2xl p-6 backdrop-blur-sm border border-indigo-500/30">
          <h2 className="text-2xl font-bold text-center text-indigo-300 mb-6">
            Character Creation
          </h2>
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column - Character Selection */}
            <div className="w-full md:w-1/2">
              <div className="mb-4">
                <label htmlFor="playerName" className="block text-sm font-medium text-gray-300 mb-1">
                  Character Name
                </label>
                <input
                  type="text"
                  id="playerName"
                  ref={nameInputRef}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full px-3 py-2 bg-gray-800 rounded border ${nameError ? 'border-red-500' : 'border-gray-600'} text-white focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  placeholder="Enter your character name"
                  autoFocus
                />
                {nameError && <p className="mt-1 text-sm text-red-500">{nameError}</p>}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Choose Your Class
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['warrior', 'mage', 'rogue', 'healer'].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setCharacterClass(cls)}
                      className={`px-4 py-2 rounded text-sm capitalize ${
                        characterClass === cls
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-gray-800 rounded text-sm text-gray-300">
                <h3 className="font-medium text-indigo-400 capitalize mb-1">{characterClass}</h3>
                <p>{classDescriptions[characterClass as keyof typeof classDescriptions]}</p>
              </div>
            </div>
            
            {/* Right Column - Character Preview */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-center">
              <div className="w-32 h-32 bg-indigo-800 rounded-full mb-4 flex items-center justify-center">
                <div className="text-4xl">
                  {characterClass === 'warrior' && '⚔️'}
                  {characterClass === 'mage' && '🔮'}
                  {characterClass === 'rogue' && '🗡️'}
                  {characterClass === 'healer' && '✨'}
                </div>
              </div>
              <p className="text-center text-gray-400 text-sm">
                Character preview will be shown here
              </p>
            </div>
          </div>
          
          {/* Start Button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleStartGame}
              disabled={isLoading}
              className={`px-8 py-3 rounded-full font-bold text-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                isLoading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-indigo-500/50'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entering World...
                </span>
              ) : (
                'Enter World'
              )}
            </button>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>© 2025 Spritel MMO • All Rights Reserved</p>
          <div className="mt-2">
            <button className="mx-2 hover:text-white">About</button>
            <button className="mx-2 hover:text-white">Privacy</button>
            <button className="mx-2 hover:text-white">Terms</button>
          </div>
        </div>
      </div>
      
      {/* Animation is handled via CSS classes and Tailwind */}
    </div>
  );
};

export default WelcomeScreen;
