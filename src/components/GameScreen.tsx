import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { GameState } from '../game/types'
import { Portrait } from './Portrait'
import { TimerRing } from './TimerRing'
import { MatchOverlay } from './MatchOverlay'
import { sfx } from '../audio/sfx'

interface Props {
  graph: Graph
  state: GameState
  onPick: (pos: number) => void
  onTimeout: () => void
}

export function GameScreen({ graph, state, onPick, onTimeout }: Props) {
  const { phase, round, miss } = state
  // During 'miss' we keep showing the failed round, annotated
  const shown = phase === 'miss' && miss ? miss.round : round
  if (!shown) return null

  const current = graph.people[shown.currentIdx]
  const missMovie = miss ? graph.movies[miss.round.shared[0]] : null

  return (
    <div className="game">
      <header className="hud">
        <div className="hud-stat">
          <span className="hud-label">Score</span>
          <span className="hud-value" key={state.score}>
            {state.score.toLocaleString()}
          </span>
        </div>
        <div className="hud-stat hud-streak">
          <span className="hud-label">Streak</span>
          <span className="hud-value" key={state.streak}>
            {state.streak}
            {state.streak >= 3 && (
              <em className="hud-combo">×{(1 + Math.min(state.streak, 20) * 0.1).toFixed(1)}</em>
            )}
          </span>
        </div>
        <div className="hud-stat hud-best">
          <span className="hud-label">Best</span>
          <span className="hud-value">{state.bestScore.toLocaleString()}</span>
        </div>
      </header>

      <main className="stage">
        <div className={`current ${phase === 'miss' ? 'lost' : ''}`} key={shown.currentIdx}>
          <div className="current-frame">
            <TimerRing
              startedAt={state.roundStartedAt}
              durationMs={shown.durationMs}
              running={phase === 'round'}
              onExpire={onTimeout}
            />
            <Portrait
              url={imageUrl(graph, current.profile, 'w342')}
              name={current.name}
              className="current-portrait"
            />
          </div>
          <p className="current-hint">Who shares a movie with</p>
          <h2 className="current-name">{current.name}</h2>
        </div>

        <div className={`choices ${phase !== 'round' ? 'locked' : ''}`}>
          {shown.choices.map((p, pos) => {
            const person = graph.people[p]
            const isCorrect = pos === shown.correctPos
            const cls = [
              'choice',
              phase === 'miss' && isCorrect ? 'was-correct' : '',
              phase === 'miss' && miss?.pickedPos === pos ? 'was-wrong' : '',
              phase === 'miss' && !isCorrect && miss?.pickedPos !== pos ? 'faded' : '',
              phase === 'reveal' && isCorrect ? 'hit' : '',
              phase === 'reveal' && !isCorrect ? 'faded' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={p}
                className={cls}
                style={{ animationDelay: `${pos * 55}ms` }}
                disabled={phase !== 'round'}
                onClick={() => onPick(pos)}
                onMouseEnter={() => phase === 'round' && sfx.hover()}
              >
                <span className="choice-key">{pos + 1}</span>
                <Portrait url={imageUrl(graph, person.profile, 'w185')} name={person.name} />
                <span className="choice-name">{person.name}</span>
              </button>
            )
          })}
        </div>

        {phase === 'miss' && miss && missMovie && (
          <div className="miss-banner">
            {miss.pickedPos === null ? 'Time’s up! ' : ''}
            The link was <strong>{graph.people[miss.round.choices[miss.correctPos]].name}</strong> —{' '}
            <strong>
              {missMovie.title} ({missMovie.year})
            </strong>
          </div>
        )}
      </main>

      {phase === 'reveal' && state.lastLink && (
        <MatchOverlay graph={graph} link={state.lastLink} streak={state.streak} />
      )}
    </div>
  )
}
