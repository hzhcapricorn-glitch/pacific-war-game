import React from 'react'
import { GameStateProvider } from './core/GameState.jsx'
import GameBoard from './components/GameBoard'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/cards.css'
import './styles/animations.css'

function App() {
  return (
    <ErrorBoundary>
      <GameStateProvider>
        <div className="app">
          <GameBoard />
        </div>
      </GameStateProvider>
    </ErrorBoundary>
  )
}

export default App
