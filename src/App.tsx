import { useEffect, useState } from 'react'
import type { Graph } from './lib/dataset'
import { loadGraph } from './lib/dataset'
import { useGame } from './game/useGame'
import { SettingsContext, useSettingsState } from './game/settings'
import { Background } from './components/Background'
import { ChainTrail } from './components/ChainTrail'
import { StartScreen } from './components/StartScreen'
import { StartPicker } from './components/StartPicker'
import { GameScreen } from './components/GameScreen'
import { GameOver } from './components/GameOver'

export default function App() {
  const settingsState = useSettingsState()
  const [graph, setGraph] = useState<Graph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const { state, start, pickChoice, timeout, toMenu } = useGame(graph)

  const retryRoute = () => {
    if (state.journey) {
      start(state.mode, { route: { startIdx: state.journey.startIdx, targetIdx: state.journey.targetIdx } })
    }
  }

  // Dev-only: expose live state so scripted play-tests can read ground truth
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __game: unknown }).__game = state
  }, [state])

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
      } else if ((state.phase === 'gameover' || state.phase === 'victory') && e.key === 'Enter') {
        start(state.mode)
      } else if (e.key === 'Escape') {
        if (state.phase !== 'menu') toMenu()
        else setShowPicker(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.phase, state.mode, pickChoice, start, toMenu])

  return (
    <SettingsContext.Provider value={settingsState}>
      <Background graph={graph} history={state.history} />
      {state.phase === 'menu' && !showPicker && (
        <StartScreen
          onStart={start}
          onOpenPicker={() => setShowPicker(true)}
          bestScore={state.bestScore}
          bestStreak={state.bestStreak}
          ready={graph !== null}
          error={error}
        />
      )}
      {state.phase === 'menu' && showPicker && graph && (
        <StartPicker
          graph={graph}
          onPick={(startIdx) => {
            setShowPicker(false)
            start('journey', { startIdx })
          }}
          onSurprise={() => {
            setShowPicker(false)
            start('journey')
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
      {(state.phase === 'round' || state.phase === 'reveal' || state.phase === 'miss') && graph && (
        <>
          {/* Journey mode has the progress rail; the ambient trail is survival-only */}
          {!state.journey && <ChainTrail graph={graph} history={state.history} />}
          <GameScreen graph={graph} state={state} onPick={pickChoice} onTimeout={timeout} />
        </>
      )}
      {(state.phase === 'gameover' || state.phase === 'victory') && graph && (
        <GameOver graph={graph} state={state} onRestart={start} onRetryRoute={retryRoute} onMenu={toMenu} />
      )}
    </SettingsContext.Provider>
  )
}
