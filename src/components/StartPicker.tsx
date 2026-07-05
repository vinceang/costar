import { useMemo, useState } from 'react'
import type { Graph } from '../lib/dataset'
import { GENRES, imageUrl } from '../lib/dataset'
import { Portrait } from './Portrait'
import { sfx } from '../audio/sfx'

interface Props {
  graph: Graph
  onPick: (startIdx: number) => void
  onSurprise: () => void
  onClose: () => void
}

const SHELF_SIZE = 24

/**
 * Journey entry point: browse genre shelves of well-known posters, tap a
 * movie you love, then pick your starting actor from its cast. The
 * destination is generated from wherever you begin.
 */
export function StartPicker({ graph, onPick, onSurprise, onClose }: Props) {
  const [openMovie, setOpenMovie] = useState<number | null>(null)

  const shelves = useMemo(
    () =>
      GENRES.map(([genreId, name]) => ({
        name,
        movies: graph.movies
          .map((m, mi) => ({ m, mi }))
          .filter(({ m }) => m.genres.includes(genreId) && m.cast.length >= 2)
          .sort((a, b) => b.m.votes - a.m.votes)
          .slice(0, SHELF_SIZE)
          .map(({ mi }) => mi),
      })).filter((s) => s.movies.length >= 8),
    [graph],
  )

  const movie = openMovie !== null ? graph.movies[openMovie] : null

  return (
    <div className="picker">
      <header className="picker-header">
        <button className="btn-link picker-back" onClick={onClose}>
          ← Back
        </button>
        <div>
          <h2 className="picker-title">Where does your journey begin?</h2>
          <p className="picker-sub">Pick a movie you love, then one of its stars.</p>
        </div>
        <button className="btn btn-primary picker-surprise" onClick={onSurprise}>
          Surprise me
        </button>
      </header>

      <div className="picker-shelves">
        {shelves.map((shelf) => (
          <section key={shelf.name} className="shelf">
            <h3 className="shelf-name">{shelf.name}</h3>
            <div className="shelf-row">
              {shelf.movies.map((mi) => {
                const m = graph.movies[mi]
                return (
                  <button
                    key={mi}
                    className={`shelf-poster ${openMovie === mi ? 'selected' : ''}`}
                    onClick={() => {
                      sfx.hover()
                      setOpenMovie(mi)
                    }}
                    title={`${m.title} (${m.year})`}
                  >
                    <img src={imageUrl(graph, m.poster, 'w185') ?? ''} alt={m.title} loading="lazy" />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {movie && openMovie !== null && (
        <div className="cast-sheet" onClick={() => setOpenMovie(null)}>
          <div className="cast-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cast-movie">
              <img src={imageUrl(graph, movie.poster, 'w185') ?? ''} alt="" />
              <div>
                <strong>
                  {movie.title} <em>({movie.year})</em>
                </strong>
                <span>Start your journey as…</span>
              </div>
            </div>
            <div className="cast-actors">
              {movie.cast.slice(0, 8).map((p) => (
                <button key={p} className="cast-actor" onClick={() => onPick(p)}>
                  <Portrait url={imageUrl(graph, graph.people[p].profile, 'w185')} name={graph.people[p].name} />
                  <span>{graph.people[p].name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
