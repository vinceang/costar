import type { Round } from '../lib/rounds'
import type { Warmth } from '../lib/journey'

export type Mode = 'endless' | 'daily' | 'journey' | 'daily-journey'

export type Phase =
  | 'menu'
  | 'round' // choices live, timer running
  | 'reveal' // valid pick: match overlay playing
  | 'miss' // wrong pick / timeout: showing what the answer was
  | 'gameover'
  | 'victory' // journey destination reached

/** One solved link in the chain, kept for the end-of-run recap. */
export interface ChainLink {
  fromIdx: number
  toIdx: number
  movieIdx: number
  extraShared: number
  points: number
  ms: number
  /** journey mode: did this hop move toward the destination? */
  warmth?: Warmth
}

/** Journey-mode run data; null in survival modes. */
export interface JourneyState {
  startIdx: number
  targetIdx: number
  par: number
  maxLinks: number
  /** current BFS distance from the player's position to the destination */
  distNow: number
  failReason: 'links' | 'unreachable' | 'timeout' | null
  /** fewest links this player has ever used on this exact route */
  routeBest: number | null
  newRouteBest: boolean
}

export interface MissInfo {
  pickedPos: number | null // null = timed out
  correctPos: number
  round: Round
}

export interface GameState {
  phase: Phase
  mode: Mode
  seed: number
  journey: JourneyState | null
  round: Round | null
  roundStartedAt: number // performance.now() timestamp
  pendingRound: Round | null // pre-generated during reveal
  score: number
  streak: number
  history: ChainLink[]
  lastLink: ChainLink | null
  miss: MissInfo | null
  picks: number // total picks incl. the final miss
  bestScore: number
  bestStreak: number
  newBest: boolean
}

export interface RunStats {
  score: number
  streak: number
  accuracy: number
  fastestMs: number | null
  /** the shared movie with the fewest votes — the "deep cut" of the run */
  rarestMovieIdx: number | null
}

export function runStats(s: GameState, votesOf: (movieIdx: number) => number): RunStats {
  const fastest = s.history.length ? Math.min(...s.history.map((l) => l.ms)) : null
  let rarest: number | null = null
  for (const link of s.history) {
    if (rarest === null || votesOf(link.movieIdx) < votesOf(rarest)) rarest = link.movieIdx
  }
  return {
    score: s.score,
    streak: s.history.length,
    accuracy: s.picks > 0 ? s.history.length / s.picks : 0,
    fastestMs: fastest,
    rarestMovieIdx: rarest,
  }
}
