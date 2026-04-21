import React from 'react'
import { GameStateProvider } from './core/GameState.jsx'
import GameBoard from './components/GameBoard'
import './styles/cards.css'
import './styles/animations.css'

function App() {
  return (
    <GameStateProvider>
      <div className="app">
        <GameBoard />
      </div>
    </GameStateProvider>
  )
}

export default App
