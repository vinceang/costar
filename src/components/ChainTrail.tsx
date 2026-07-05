import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { ChainLink } from '../game/types'
import { Portrait } from './Portrait'

interface Props {
  graph: Graph
  history: ChainLink[]
}

const MAX_VISIBLE = 7

/**
 * Ambient record of the run: a faded vertical chain of solved links in the
 * left margin, newest at the bottom. Older links slide up and eventually
 * collapse into a "+n" counter. Purely decorative — behind the game layer,
 * pointer-events: none, hidden on narrow screens.
 */
export function ChainTrail({ graph, history }: Props) {
  if (history.length === 0) return null

  const actors = [history[0].fromIdx, ...history.map((l) => l.toIdx)]
  const visible = actors.slice(-MAX_VISIBLE)
  const hidden = actors.length - visible.length

  return (
    <div className="chain-trail" aria-hidden>
      {hidden > 0 && <div className="chain-more">+{hidden}</div>}
      {visible.map((personIdx, i) => {
        const chainPos = hidden + i
        const person = graph.people[personIdx]
        const isLatest = i === visible.length - 1
        // Older links fade harder; the newest stays the most present
        const opacity = 0.25 + 0.45 * (i / Math.max(1, visible.length - 1))
        return (
          // Keyed by chain position: each node pops in once, when its link lands
          <div key={chainPos} className={`chain-node ${isLatest ? 'latest' : ''}`} style={{ opacity }}>
            {(i > 0 || hidden > 0) && <span className="chain-line" />}
            <Portrait url={imageUrl(graph, person.profile, 'w185')} name={person.name} />
          </div>
        )
      })}
    </div>
  )
}
