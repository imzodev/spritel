import { useState, useEffect } from 'react'
import Game from './components/Game'
import WelcomeScreen from './components/WelcomeScreen'

function App() {
  const [gameStarted, setGameStarted] = useState(false)

  // Apply overflow hidden to body to prevent scrollbars
  useEffect(() => {
    // Save original styles
    const originalOverflow = document.body.style.overflow
    
    // Apply new styles
    document.body.style.overflow = 'hidden'
    
    // Cleanup function to restore original styles
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleStartGame = () => {
    setGameStarted(true)
  }

  return (
    <div className="w-full h-full">
      {!gameStarted && <WelcomeScreen onStart={handleStartGame} />}
      <Game />
    </div>
  )
}

export default App
