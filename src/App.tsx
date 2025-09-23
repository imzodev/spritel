import { useState, useEffect } from 'react'
import Game from './components/Game'
import WelcomeScreen from './components/WelcomeScreen'
import AuthForm from './components/AuthForm'
import type { UserDto } from './services/auth'
import { me, logout } from './services/auth'
import PauseMenu from './components/PauseMenu'

function App() {
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null)
  const [hasPlayer, setHasPlayer] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('spritel_player_name')
    } catch {
      return false
    }
  })
  const [showMenu, setShowMenu] = useState(false)

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

  // Global key handler: toggle pause menu with 'P' only when in-game
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (currentUser && hasPlayer && (e.key === 'p' || e.key === 'P')) {
        setShowMenu(v => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentUser, hasPlayer])

  return (
    <div className="w-full h-full">
      {/* Pause Menu modal */}
      <PauseMenu
        open={showMenu}
        onClose={() => setShowMenu(false)}
        onSignOut={async () => {
          try {
            await logout()
          } finally {
            try {
              localStorage.removeItem('spritel_player_name')
              localStorage.removeItem('spritel_player_class')
            } catch {}
            setHasPlayer(false)
            setCurrentUser(null)
            setShowMenu(false)
          }
        }}
      />

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
      {currentUser && hasPlayer && (
        <>
          {/* Small pause button overlay (useful on mobile) */}
          <button
            aria-label="Open pause menu"
            onClick={() => setShowMenu(true)}
            className="fixed top-3 right-3 z-40 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-900/80 border border-gray-700 text-gray-200 hover:bg-gray-800 shadow-lg backdrop-blur"
          >
            {/* Pause icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M8 4h3v16H8zM13 4h3v16h-3z" />
            </svg>
          </button>
          <Game />
        </>
      )}
    </div>
  )
}

export default App
