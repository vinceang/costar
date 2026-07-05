import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { ChainLink, JourneyState } from '../game/types'

interface Props {
  graph: Graph
  link: ChainLink
  streak: number
  journey?: JourneyState | null
  arrived?: boolean
  onSkip: () => void
}

const WARMTH_TEXT = {
  closer: { icon: '🔥', label: 'Getting closer' },
  same: { icon: '〰️', label: 'Sideways move' },
  further: { icon: '❄️', label: 'Drifting away' },
} as const

/**
 * The "match moment": both actors, an energized beam between them, the shared
 * movie poster flipping in, and the points earned. Timed to REVEAL_MS.
 */
export function MatchOverlay({ graph, link, streak, journey, arrived, onSkip }: Props) {
  const linksLeft = journey ? journey.maxLinks - streak : 0
  const warmth = link.warmth ? WARMTH_TEXT[link.warmth] : null
  const alsoIn = (link.sharedAll ?? []).slice(1, 3)
  const moreCount = link.extraShared - alsoIn.length
  const from = graph.people[link.fromIdx]
  const to = graph.people[link.toIdx]
  const movie = graph.movies[link.movieIdx]
  const backdrop = imageUrl(graph, movie.backdrop, 'w780')
  const poster = imageUrl(graph, movie.poster, 'w342')

  return (
    <div className="match" role="status" onClick={onSkip}>
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
            {alsoIn.length > 0 && (
              <span className="match-extra">
                also in{' '}
                {alsoIn.map((mi, i) => (
                  <em key={mi}>
                    {i > 0 && ' · '}
                    {graph.movies[mi].title}
                  </em>
                ))}
                {moreCount > 0 && ` +${moreCount} more`}
              </span>
            )}
          </div>
        </div>

        {journey ? (
          <div className={`match-warmth ${arrived ? 'arrived' : link.warmth}`}>
            {arrived ? (
              <>🎯 Arrived!</>
            ) : (
              warmth && (
                <>
                  {warmth.icon} {warmth.label}
                  <span className="match-links-left">
                    {linksLeft} link{linksLeft === 1 ? '' : 's'} left
                  </span>
                </>
              )
            )}
          </div>
        ) : (
          <div className="match-points">
            +{link.points.toLocaleString()}
            {streak >= 3 && (
              <span className="match-combo">×{(1 + Math.min(streak - 1, 20) * 0.1).toFixed(1)} combo</span>
            )}
          </div>
        )}

        <span className="match-continue">tap to continue</span>
      </div>
    </div>
  )
}
