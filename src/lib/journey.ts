/**
 * Journey mode: route from a start actor to a destination actor in at most
 * MAX_LINKS shared-movie hops. Unlike survival, every choice offered is a
 * genuine co-star of the current actor — the challenge is picking the one
 * that leads toward the destination. BFS from the destination gives every
 * actor a distance, which powers par, warmth feedback, and the guarantee
 * that each round contains at least one distance-reducing choice.
 */
import type { Graph } from './dataset'
import type { Rng } from './rng'
import { randInt, shuffle } from './rng'
import { pickStartActor } from './rounds'

export const MAX_LINKS = 6
export const JOURNEY_ROUND_MS = 25000

export type Warmth = 'closer' | 'same' | 'further'

export interface JourneyPair {
  startIdx: number
  targetIdx: number
  par: number
  /** BFS distance to target for every actor (-1 = unreachable) */
  dist: Int16Array
}

export interface JourneyRound {
  currentIdx: number
  choices: number[]
  durationMs: number
}

export function bfsFrom(g: Graph, source: number): Int16Array {
  const dist = new Int16Array(g.people.length).fill(-1)
  dist[source] = 0
  const queue = [source]
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head]
    for (const next of g.adj[node]) {
      if (dist[next] === -1) {
        dist[next] = dist[node] + 1
        queue.push(next)
      }
    }
  }
  return dist
}

/** Rebuild a pair for a known route (Retry Route, daily replay). */
export function makePair(g: Graph, startIdx: number, targetIdx: number): JourneyPair {
  const dist = bfsFrom(g, targetIdx)
  return { startIdx, targetIdx, par: dist[startIdx], dist }
}

/**
 * A start/destination pair, both famous and well-connected. `fixedStart` pins
 * the player-chosen starting actor; the destination is then found by relaxing
 * the ideal 3–4 hop distance until candidates exist.
 */
export function pickJourneyPair(g: Graph, rng: Rng, fixedStart?: number): JourneyPair {
  for (let attempt = 0; attempt < 12; attempt++) {
    const startIdx = fixedStart ?? pickStartActor(g, rng)
    const fromStart = bfsFrom(g, startIdx)
    const pool = g.byPopularity.slice(0, 400)
    const tiers = [
      pool.filter((p) => (fromStart[p] === 3 || fromStart[p] === 4) && g.adj[p].size >= 8),
      pool.filter((p) => fromStart[p] >= 2 && fromStart[p] <= 5 && g.adj[p].size >= 5),
      pool.filter((p) => fromStart[p] >= 2),
    ]
    const candidates = tiers.find((t) => t.length > 0)
    if (!candidates) {
      if (fixedStart !== undefined) break // hopeless start actor: fall through
      continue
    }
    const targetIdx = candidates[randInt(rng, candidates.length)]
    return { startIdx, targetIdx, par: fromStart[targetIdx], dist: bfsFrom(g, targetIdx) }
  }
  // Isolated fixed start (or dense-graph miracle): fall back to a random pair
  if (fixedStart !== undefined) return pickJourneyPair(g, rng)
  throw new Error('could not build a journey pair')
}

export function warmthOf(pair: JourneyPair, from: number, to: number): Warmth {
  const d = pair.dist[to] - pair.dist[from]
  return d < 0 ? 'closer' : d === 0 ? 'same' : 'further'
}

/**
 * Free-roam assist: the longer the player drifts (consecutive hops that don't
 * get closer), the fewer choices they face — the guaranteed closer-choice is
 * always among them, so a smaller lineup means better odds of finding it.
 * A closer hop resets the drift, restoring 4 choices.
 */
export function freeRoamChoiceCount(drift: number): number {
  if (drift >= 3) return 2
  if (drift >= 2) return 3
  return 4
}

export function generateJourneyRound(
  g: Graph,
  rng: Rng,
  currentIdx: number,
  pair: JourneyPair,
  visited: Set<number>,
  choiceCount = 5,
): JourneyRound {
  const distCur = pair.dist[currentIdx]
  const neighbors = [...g.adj[currentIdx]]
  const byFame = (a: number, b: number) => g.people[b].pop - g.people[a].pop

  // Guaranteed way forward. When the destination is one hop away it IS the
  // reducing choice — the arrival moment.
  const reducing = neighbors.filter((p) => pair.dist[p] === distCur - 1)
  const reducingFresh = reducing.filter((p) => !visited.has(p))
  const guaranteed =
    distCur === 1
      ? pair.targetIdx
      : (reducingFresh.length ? reducingFresh : reducing).sort(byFame)[
          randInt(rng, Math.max(1, Math.ceil((reducingFresh.length || reducing.length) / 2)))
        ]

  // Fill with other co-stars — famous faces first, unvisited preferred.
  // These may include additional reducing choices; that's fine (kinder).
  const fillPool = neighbors
    .filter((p) => p !== guaranteed && p !== pair.targetIdx)
    .sort((a, b) => {
      const visitPenalty = (visited.has(a) ? 1 : 0) - (visited.has(b) ? 1 : 0)
      return visitPenalty || byFame(a, b)
    })
  const fill = shuffle(rng, fillPool.slice(0, 12)).slice(0, choiceCount - 1)

  const choices = shuffle(rng, [guaranteed, ...fill])
  return { currentIdx, choices, durationMs: JOURNEY_ROUND_MS }
}
