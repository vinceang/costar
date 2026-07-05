import { Fragment } from 'react'
import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { GameState, Mode } from '../game/types'
import { runStats } from '../game/types'
import { Portrait } from './Portrait'

interface Props {
  graph: Graph
  state: GameState
  onRestart: (mode: Mode) => void
  onMenu: () => void
}

export function GameOver({ graph, state, onRestart, onMenu }: Props) {
  const stats = runStats(state, (mi) => graph.movies[mi].votes)
  const rarest = stats.rarestMovieIdx !== null ? graph.movies[stats.rarestMovieIdx] : null
  const chainActors =
    state.history.length > 0
      ? [state.history[0].fromIdx, ...state.history.map((l) => l.toIdx)]
      : []

  return (
    <div className="gameover">
      <div className="gameover-panel">
        <p className="go-kicker">{state.mode === 'daily' ? 'Daily challenge over' : 'Run over'}</p>
        <div className="go-score">
          {stats.score.toLocaleString()}
          {state.newBest && <span className="go-newbest">New best!</span>}
        </div>
        <p className="go-streak">
          Chain of <strong>{stats.streak}</strong>
        </p>

        <div className="go-stats">
          <div>
            <span>{Math.round(stats.accuracy * 100)}%</span>
            <label>Accuracy</label>
          </div>
          <div>
            <span>{stats.fastestMs !== null ? `${(stats.fastestMs / 1000).toFixed(2)}s` : '—'}</span>
            <label>Fastest pick</label>
          </div>
          <div>
            <span>{state.bestStreak}</span>
            <label>Best streak</label>
          </div>
          {rarest && (
            <div className="go-rare">
              <span>{rarest.title}</span>
              <label>Deepest cut</label>
            </div>
          )}
        </div>

        {state.history.length > 0 && (
          <div className="go-chain">
            {chainActors.map((actorIdx, i) => (
              <Fragment key={`${actorIdx}-${i}`}>
                {i > 0 && (
                  <span className="go-chain-movie" title={graph.movies[state.history[i - 1].movieIdx].title}>
                    {graph.movies[state.history[i - 1].movieIdx].title}
                  </span>
                )}
                <div className="go-chain-actor">
                  <Portrait
                    url={imageUrl(graph, graph.people[actorIdx].profile, 'w185')}
                    name={graph.people[actorIdx].name}
                  />
                  <span>{graph.people[actorIdx].name}</span>
                </div>
              </Fragment>
            ))}
          </div>
        )}

        <div className="go-buttons">
          <button className="btn btn-primary" onClick={() => onRestart('endless')} autoFocus>
            Play Again
          </button>
          <button className="btn" onClick={onMenu}>
            Menu
          </button>
        </div>
        <p className="go-hint">Press Enter to play again</p>
      </div>
    </div>
  )
}
