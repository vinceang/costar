import { Fragment, useState } from 'react'
import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { GameState, Mode } from '../game/types'
import { runStats } from '../game/types'
import { buildShareText, shareResult } from '../lib/share'
import { Portrait } from './Portrait'

interface Props {
  graph: Graph
  state: GameState
  onRestart: (mode: Mode) => void
  onRetryRoute: () => void
  onKeepExploring: () => void
  onMenu: () => void
}

const FAIL_TEXT = {
  links: 'Out of links — the trail ran too long.',
  unreachable: 'The trail went cold — too far away to make it back.',
  timeout: 'Time ran out mid-route.',
} as const

function parVerdict(links: number, par: number): string {
  const over = links - par
  if (over <= 0) return 'Perfect route!'
  return `${over} over par`
}

export function GameOver({ graph, state, onRestart, onRetryRoute, onKeepExploring, onMenu }: Props) {
  const [shareLabel, setShareLabel] = useState('Share')
  const stats = runStats(state, (mi) => graph.movies[mi].votes)
  const rarest = stats.rarestMovieIdx !== null ? graph.movies[stats.rarestMovieIdx] : null
  const j = state.journey
  const won = state.phase === 'victory'
  const chainActors =
    state.history.length > 0
      ? [state.history[0].fromIdx, ...state.history.map((l) => l.toIdx)]
      : []

  const doShare = async () => {
    try {
      const result = await shareResult(buildShareText(graph, state))
      setShareLabel(result === 'copied' ? 'Copied ✓' : 'Shared ✓')
    } catch {
      setShareLabel('Copy failed')
    }
    setTimeout(() => setShareLabel('Share'), 1800)
  }

  return (
    <div className={`gameover ${won ? 'won' : ''}`}>
      <div className="gameover-panel">
        {j ? (
          <>
            <p className="go-kicker">
              {won ? (j.freeRoam ? '🧭 Found them' : '🎯 Arrived') : 'Journey lost'}
              {state.mode === 'daily-journey' ? ' · Daily' : ''}
            </p>
            <div className="go-journey-route">
              {graph.people[j.startIdx].name} <span>→</span> {graph.people[j.targetIdx].name}
            </div>
            {won ? (
              <p className="go-streak">
                {j.freeRoam ? 'Found in ' : 'Linked in '}
                <strong>{state.history.length}</strong> · Par {j.par} ·{' '}
                <strong className="go-verdict">
                  {j.freeRoam ? 'beyond the budget — now do it in 6' : parVerdict(state.history.length, j.par)}
                </strong>
                {j.newRouteBest && state.history.length > j.par && (
                  <span className="go-routebest">New route best!</span>
                )}
              </p>
            ) : (
              <p className="go-streak">
                {j.failReason ? FAIL_TEXT[j.failReason] : ''}
                {j.routeBest !== null && (
                  <span className="go-routebest-note"> Your best on this route: {j.routeBest}.</span>
                )}
              </p>
            )}
            <div className="go-warmth-trail">
              {state.history.map((l, i) => (
                <span key={i}>{l.warmth === 'closer' ? '🔥' : l.warmth === 'further' ? '❄️' : '〰️'}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="go-kicker">{state.mode === 'daily' ? 'Daily challenge over' : 'Run over'}</p>
            <div className="go-score">
              {stats.score.toLocaleString()}
              {state.newBest && <span className="go-newbest">New best!</span>}
            </div>
            <p className="go-streak">
              Chain of <strong>{stats.streak}</strong>
            </p>
          </>
        )}

        <div className="go-stats">
          {j ? (
            <div>
              <span>
                {state.history.length}/{j.maxLinks}
              </span>
              <label>Links used</label>
            </div>
          ) : (
            <div>
              <span>{Math.round(stats.accuracy * 100)}%</span>
              <label>Accuracy</label>
            </div>
          )}
          <div>
            <span>{stats.fastestMs !== null ? `${(stats.fastestMs / 1000).toFixed(2)}s` : '—'}</span>
            <label>Fastest pick</label>
          </div>
          {!j && (
            <div>
              <span>{state.bestStreak}</span>
              <label>Best streak</label>
            </div>
          )}
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
          {j && !won && (
            // Closure over challenge: wander the graph until you find them
            <button className="btn btn-primary" onClick={onKeepExploring} autoFocus>
              Keep Exploring
            </button>
          )}
          {j && (won ? state.history.length > j.par : true) ? (
            <button className={`btn ${!won ? '' : 'btn-primary'}`} onClick={onRetryRoute} autoFocus={won}>
              Retry Route
            </button>
          ) : null}
          <button
            className={`btn ${j && (won ? state.history.length > j.par : true) ? '' : 'btn-primary'}`}
            onClick={() => onRestart(state.mode)}
            autoFocus={!j || (won && state.history.length <= j.par)}
          >
            {j ? 'New Journey' : 'Play Again'}
          </button>
          {state.history.length > 0 && (
            <button className="btn" onClick={doShare}>
              {shareLabel}
            </button>
          )}
          <button className="btn" onClick={onMenu}>
            Menu
          </button>
        </div>
        <p className="go-hint">Press Enter to play again</p>
      </div>
    </div>
  )
}
