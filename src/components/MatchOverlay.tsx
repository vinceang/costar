import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { ChainLink } from '../game/types'

interface Props {
  graph: Graph
  link: ChainLink
  streak: number
}

/**
 * The "match moment": both actors, an energized beam between them, the shared
 * movie poster flipping in, and the points earned. Timed to REVEAL_MS.
 */
export function MatchOverlay({ graph, link, streak }: Props) {
  const from = graph.people[link.fromIdx]
  const to = graph.people[link.toIdx]
  const movie = graph.movies[link.movieIdx]
  const backdrop = imageUrl(graph, movie.backdrop, 'w780')
  const poster = imageUrl(graph, movie.poster, 'w342')

  return (
    <div className="match" role="status">
      {backdrop && (
        <div className="match-backdrop" style={{ backgroundImage: `url(${backdrop})` }} />
      )}
      <div className="match-body">
        <div className="match-actors">
          <div className="match-actor from">
            <img src={imageUrl(graph, from.profile, 'w185') ?? ''} alt={from.name} />
            <span>{from.name}</span>
          </div>
          <div className="match-beam">
            <span className="beam-line" />
            <span className="beam-pulse" />
          </div>
          <div className="match-actor to">
            <img src={imageUrl(graph, to.profile, 'w185') ?? ''} alt={to.name} />
            <span>{to.name}</span>
          </div>
        </div>

        <div className="match-movie">
          {poster && <img className="match-poster" src={poster} alt="" />}
          <div className="match-movie-text">
            <span className="match-label">Together in</span>
            <strong className="match-title">
              {movie.title} <em>({movie.year})</em>
            </strong>
            {link.extraShared > 0 && (
              <span className="match-extra">
                +{link.extraShared} more film{link.extraShared > 1 ? 's' : ''} together
              </span>
            )}
          </div>
        </div>

        <div className="match-points">
          +{link.points.toLocaleString()}
          {streak >= 3 && <span className="match-combo">×{(1 + Math.min(streak - 1, 20) * 0.1).toFixed(1)} combo</span>}
        </div>
      </div>
    </div>
  )
}
