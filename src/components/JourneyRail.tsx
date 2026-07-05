import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { GameState } from '../game/types'
import { Portrait } from './Portrait'

interface Props {
  graph: Graph
  state: GameState
}

/**
 * The journey's spine: start portrait, one slot per allowed link filling up
 * with the actors you route through, and the destination pulsing at the end.
 * Slot connectors take the warmth color of the hop that filled them.
 */
export function JourneyRail({ graph, state }: Props) {
  const j = state.journey
  if (!j) return null
  const target = graph.people[j.targetIdx]
  const links = state.history

  return (
    <div className="jrail" aria-label={`Journey to ${target.name}`}>
      <div className="jrail-end">
        <Portrait
          url={imageUrl(graph, graph.people[j.startIdx].profile, 'w185')}
          name={graph.people[j.startIdx].name}
        />
      </div>
      {Array.from({ length: j.maxLinks }, (_, i) => {
        const link = links[i]
        return (
          <div key={i} className={`jrail-slot ${link ? `filled ${link.warmth}` : ''}`}>
            <span className="jrail-line" />
            {link ? (
              <Portrait
                url={imageUrl(graph, graph.people[link.toIdx].profile, 'w185')}
                name={graph.people[link.toIdx].name}
              />
            ) : (
              <span className="jrail-dot" />
            )}
          </div>
        )
      })}
      <div className={`jrail-end jrail-target ${state.phase === 'victory' ? 'reached' : ''}`}>
        <span className="jrail-line" />
        <Portrait url={imageUrl(graph, target.profile, 'w185')} name={target.name} />
        <span className="jrail-target-name">{target.name}</span>
      </div>
    </div>
  )
}
