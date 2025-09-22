import { useState, useEffect } from 'react'
import Game from './components/Game'
import WelcomeScreen from './components/WelcomeScreen'
import AuthForm from './components/AuthForm'
import type { UserDto } from './services/auth'
import { me } from './services/auth'

function App() {
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null)
  const [hasPlayer, setHasPlayer] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('spritel_player_name')
    } catch {
      return false
    }
  })

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

  // Initialize current session user
  useEffect(() => {
    me().then(u => setCurrentUser(u)).catch(() => setCurrentUser(null))
  }, [])

  return (
    <div className="w-full h-full">
      {/* 1) Not authenticated: show auth form only */}
      {!currentUser && (
        <div className="fixed inset-0 flex items-center justify-center">
          <AuthForm onAuthed={(u) => setCurrentUser(u)} />
        </div>
      )}

      {/* 2) Authenticated but no player created yet: show welcome/character creation */}
      {currentUser && !hasPlayer && (
        <WelcomeScreen onStart={() => setHasPlayer(true)} />
      )}

      {/* 3) Authenticated and player exists: go straight to game */}
      {currentUser && hasPlayer && <Game />}
    </div>
  )
}

export default App
