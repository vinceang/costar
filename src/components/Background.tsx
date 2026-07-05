import { useMemo } from 'react'
import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { ChainLink } from '../game/types'

interface Props {
  graph: Graph | null
  history: ChainLink[]
}

/**
 * Cinematic backdrop layer: the last matched movie's backdrop slowly zooming,
 * plus a drift of poster "bubbles" collected across the run.
 */
export function Background({ graph, history }: Props) {
  const lastLink = history[history.length - 1]
  const backdrop =
    graph && lastLink ? imageUrl(graph, graph.movies[lastLink.movieIdx].backdrop, 'w780') : null

  const floaters = useMemo(() => {
    if (!graph) return []
    return history.slice(-9).map((link, i) => {
      const url = imageUrl(graph, graph.movies[link.movieIdx].poster, 'w185')
      // Deterministic per movie so re-renders don't reshuffle positions
      const h = (link.movieIdx * 2654435761) >>> 0
      return {
        key: `${link.movieIdx}-${i}`,
        url,
        left: 4 + (h % 88),
        duration: 26 + (h % 18),
        delay: -((h >> 4) % 26),
        size: 54 + ((h >> 8) % 40),
      }
    })
  }, [graph, history])

  return (
    <div className="bg" aria-hidden>
      <div className="bg-gradient" />
      {backdrop && (
        <div key={backdrop} className="bg-backdrop" style={{ backgroundImage: `url(${backdrop})` }} />
      )}
      <div className="bg-floaters">
        {floaters.map((f) =>
          f.url ? (
            <img
              key={f.key}
              className="bg-poster"
              src={f.url}
              alt=""
              style={{
                left: `${f.left}%`,
                width: f.size,
                animationDuration: `${f.duration}s`,
                animationDelay: `${f.delay}s`,
              }}
            />
          ) : null,
        )}
      </div>
      <div className="bg-vignette" />
    </div>
  )
}
