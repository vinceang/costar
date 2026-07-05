import { useState } from 'react'
import type { Mode } from '../game/types'
import { useSettings } from '../game/settings'

interface Props {
  onStart: (mode: Mode) => void
  bestScore: number
  bestStreak: number
  ready: boolean
  error: string | null
}

export function StartScreen({ onStart, bestScore, bestStreak, ready, error }: Props) {
  const [showAbout, setShowAbout] = useState(false)
  const { settings, update } = useSettings()

  return (
    <div className="menu">
      <div className="menu-inner">
        <p className="menu-kicker">The movie connection survival game</p>
        <h1 className="menu-title">
          CO<span>★</span>STAR
        </h1>
        <p className="menu-tag">
          One actor. Five faces. Only one of them shares a movie credit — find the co-star before
          the clock runs out and keep the chain alive.
        </p>

        {error ? (
          <p className="menu-error">Couldn’t load the movie graph: {error}</p>
        ) : (
          <div className="menu-buttons">
            <button className="btn btn-primary" disabled={!ready} onClick={() => onStart('endless')}>
              {ready ? 'Play Endless' : 'Loading…'}
            </button>
            <button className="btn" disabled={!ready} onClick={() => onStart('daily')}>
              Daily Challenge
            </button>
          </div>
        )}

        {(bestScore > 0 || bestStreak > 0) && (
          <p className="menu-best">
            Best score <strong>{bestScore.toLocaleString()}</strong> · Best streak{' '}
            <strong>{bestStreak}</strong>
          </p>
        )}

        <div className="menu-settings">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(e) => update({ sound: e.target.checked })}
            />
            <span>Sound</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.motion === 'full'}
              onChange={(e) => update({ motion: e.target.checked ? 'full' : 'reduced' })}
            />
            <span>Full motion</span>
          </label>
          <button className="btn-link" onClick={() => setShowAbout(true)}>
            About
          </button>
        </div>
      </div>

      {showAbout && (
        <div className="modal-backdrop" onClick={() => setShowAbout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>About COSTAR</h3>
            <p>
              A survival-mode take on Six Degrees of Kevin Bacon. Chain actors together through
              shared movie credits for as long as you can. Faster picks and longer streaks score
              more; obscure connections earn a deep-cut bonus.
            </p>
            <p className="tmdb-notice">
              <img
                src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                alt="TMDB"
                width="120"
              />
              <span>
                This product uses the TMDB API but is not endorsed or certified by{' '}
                <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
                  TMDB
                </a>
                . All film data and imagery courtesy of TMDB. Non-commercial use only under the
                free TMDB API license; commercial use requires a separate license from TMDB.
              </span>
            </p>
            <button className="btn" onClick={() => setShowAbout(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
