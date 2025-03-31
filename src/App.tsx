import { useState } from 'react'
import Game from './components/Game'
import WelcomeScreen from './components/WelcomeScreen'

function App() {
  const [gameStarted, setGameStarted] = useState(false)

  const handleStartGame = () => {
    setGameStarted(true)
  }

  return (
    <>
      {!gameStarted && <WelcomeScreen onStart={handleStartGame} />}
      <Game />
    </>
  )
}

export default App
