import { useEffect, useState } from 'react'
import type { Graph } from './lib/dataset'
import { loadGraph } from './lib/dataset'
import { useGame } from './game/useGame'
import { SettingsContext, useSettingsState } from './game/settings'
import { Background } from './components/Background'
import { StartScreen } from './components/StartScreen'
import { GameScreen } from './components/GameScreen'
import { GameOver } from './components/GameOver'

export default function App() {
  const settingsState = useSettingsState()
  const [graph, setGraph] = useState<Graph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { state, start, pickChoice, timeout, toMenu } = useGame(graph)

  useEffect(() => {
    let cancelled = false
    loadGraph()
      .then((g) => !cancelled && setGraph(g))
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  // Keyboard: 1–5 pick, Enter restarts, Esc to menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.phase === 'round' && e.key >= '1' && e.key <= '5') {
        pickChoice(Number(e.key) - 1)
      } else if (state.phase === 'gameover' && e.key === 'Enter') {
        start(state.mode)
      } else if (e.key === 'Escape' && state.phase !== 'menu') {
        toMenu()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.phase, state.mode, pickChoice, start, toMenu])

  return (
    <SettingsContext.Provider value={settingsState}>
      <Background graph={graph} history={state.history} />
      {state.phase === 'menu' && (
        <StartScreen
          onStart={start}
          bestScore={state.bestScore}
          bestStreak={state.bestStreak}
          ready={graph !== null}
          error={error}
        />
      )}
      {(state.phase === 'round' || state.phase === 'reveal' || state.phase === 'miss') && graph && (
        <GameScreen graph={graph} state={state} onPick={pickChoice} onTimeout={timeout} />
      )}
      {state.phase === 'gameover' && graph && (
        <GameOver graph={graph} state={state} onRestart={start} onMenu={toMenu} />
      )}
    </SettingsContext.Provider>
  )
}
