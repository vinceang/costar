/**
 * Game orchestration hook: owns the run state machine and all transitions.
 *
 *   menu -> round -> (pick correct) -> reveal -> round -> ...
 *               \--> (pick wrong / timeout) -> miss -> gameover -> menu/round
 *
 * Round generation is synchronous against the in-memory graph, so the next
 * round is built the moment a correct pick lands and its images preload
 * behind the reveal overlay. All impure work (rng, sfx, timers) happens in
 * event handlers — state updaters stay pure for StrictMode safety.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Graph } from '../lib/dataset'
import { imageUrl } from '../lib/dataset'
import type { Rng } from '../lib/rng'
import { createRng, hashString } from '../lib/rng'
import type { Round } from '../lib/rounds'
import { generateRound, pickStartActor } from '../lib/rounds'
import { sfx } from '../audio/sfx'
import type { ChainLink, GameState, Mode } from './types'

export const REVEAL_MS = 1750
export const MISS_MS = 2400
const RECENT_FACES_WINDOW = 40
const DEEP_CUT_VOTES = 4000

const BEST_KEY = 'costar.best'

function loadBest(): { score: number; streak: number } {
  try {
    return { score: 0, streak: 0, ...JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') }
  } catch {
    return { score: 0, streak: 0 }
  }
}

export function dailySeed(): number {
  const d = new Date()
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return hashString(key)
}

function initialState(best = loadBest()): GameState {
  return {
    phase: 'menu',
    mode: 'endless',
    seed: 0,
    round: null,
    roundStartedAt: 0,
    pendingRound: null,
    score: 0,
    streak: 0,
    history: [],
    lastLink: null,
    miss: null,
    picks: 0,
    bestScore: best.score,
    bestStreak: best.streak,
    newBest: false,
  }
}

function preloadRound(g: Graph, round: Round) {
  const urls: (string | null)[] = round.choices.map((p) => imageUrl(g, g.people[p].profile, 'w185'))
  urls.push(imageUrl(g, g.people[round.currentIdx].profile, 'w342'))
  const best = round.shared[0]
  if (best !== undefined) {
    urls.push(imageUrl(g, g.movies[best].poster, 'w342'))
    urls.push(imageUrl(g, g.movies[best].backdrop, 'w780'))
  }
  for (const u of urls) {
    if (u) new Image().src = u
  }
}

export function useGame(graph: Graph | null) {
  const [state, setState] = useState<GameState>(initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const rngRef = useRef<Rng>(createRng(1))
  const usedActors = useRef<Set<number>>(new Set())
  const recentFaces = useRef<number[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Authoritative round clock: the TimerRing's rAF loop is display-only and
  // pauses in background tabs, so expiry must be enforced here too.
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      clearTimeout(timeoutRef.current ?? undefined)
      clearTimeout(roundTimerRef.current ?? undefined)
    },
    [],
  )

  const noteFaces = (round: Round) => {
    recentFaces.current.push(...round.choices)
    recentFaces.current = recentFaces.current.slice(-RECENT_FACES_WINDOW)
  }

  /** Generate a round from `from`; if the chain is boxed in, teleport to a fresh actor. */
  const nextRound = useCallback((g: Graph, from: number, streak: number): Round => {
    const rng = rngRef.current
    const faces = new Set(recentFaces.current)
    let round = generateRound(g, rng, from, usedActors.current, faces, streak)
    let guard = 0
    while (!round && guard++ < 20) {
      const fresh = pickStartActor(g, rng, usedActors.current)
      round = generateRound(g, rng, fresh, usedActors.current, faces, streak)
    }
    if (!round) {
      // Effectively unreachable with ~1000 actors: reset exclusions and retry
      usedActors.current = new Set()
      round = generateRound(g, rng, pickStartActor(g, rng), new Set(), new Set(), streak)!
    }
    usedActors.current.add(round.choices[round.correctPos])
    noteFaces(round)
    preloadRound(g, round)
    return round
  }, [])

  const resolveMiss = useCallback((pickedPos: number | null) => {
    const s = stateRef.current
    if (s.phase !== 'round' || !s.round) return
    clearTimeout(roundTimerRef.current ?? undefined)
    sfx.wrong()
    setState({
      ...s,
      phase: 'miss',
      picks: s.picks + 1,
      miss: { pickedPos, correctPos: s.round.correctPos, round: s.round },
    })
    clearTimeout(timeoutRef.current ?? undefined)
    timeoutRef.current = setTimeout(() => {
      const cur = stateRef.current
      if (cur.phase !== 'miss') return
      sfx.gameover()
      const bestScore = Math.max(cur.bestScore, cur.score)
      const bestStreak = Math.max(cur.bestStreak, cur.streak)
      const newBest = cur.score > cur.bestScore && cur.score > 0
      localStorage.setItem(BEST_KEY, JSON.stringify({ score: bestScore, streak: bestStreak }))
      setState({ ...cur, phase: 'gameover', bestScore, bestStreak, newBest })
    }, MISS_MS)
  }, [])

  const armRoundTimer = useCallback(
    (durationMs: number) => {
      clearTimeout(roundTimerRef.current ?? undefined)
      roundTimerRef.current = setTimeout(() => {
        if (stateRef.current.phase === 'round') resolveMiss(null)
      }, durationMs + 120)
    },
    [resolveMiss],
  )

  const start = useCallback(
    (mode: Mode) => {
      if (!graph) return
      clearTimeout(timeoutRef.current ?? undefined)
      const seed = mode === 'daily' ? dailySeed() : (Math.random() * 2 ** 32) >>> 0
      rngRef.current = createRng(seed)
      usedActors.current = new Set()
      recentFaces.current = []
      const startActor = pickStartActor(graph, rngRef.current)
      usedActors.current.add(startActor)
      const round = nextRound(graph, startActor, 0)
      sfx.whoosh()
      armRoundTimer(round.durationMs)
      setState({
        ...initialState({ score: stateRef.current.bestScore, streak: stateRef.current.bestStreak }),
        phase: 'round',
        mode,
        seed,
        round,
        roundStartedAt: performance.now(),
      })
    },
    [graph, nextRound, armRoundTimer],
  )

  const pickChoice = useCallback(
    (pos: number) => {
      const s = stateRef.current
      if (!graph || s.phase !== 'round' || !s.round) return
      const elapsed = performance.now() - s.roundStartedAt

      // Late pick (throttled background tab, etc.) counts as a timeout
      if (elapsed > s.round.durationMs + 250) {
        resolveMiss(null)
        return
      }

      if (pos !== s.round.correctPos) {
        resolveMiss(pos)
        return
      }
      clearTimeout(roundTimerRef.current ?? undefined)

      const round = s.round
      const picked = round.choices[pos]
      const remaining = Math.max(0, round.durationMs - elapsed)
      const movieIdx = round.shared[0]
      const deepCut = graph.movies[movieIdx].votes < DEEP_CUT_VOTES
      const multiplier = 1 + Math.min(s.streak, 20) * 0.1
      const points = Math.round((100 + remaining / 100 + (deepCut ? 150 : 0)) * multiplier)

      const link: ChainLink = {
        fromIdx: round.currentIdx,
        toIdx: picked,
        movieIdx,
        extraShared: round.shared.length - 1,
        points,
        ms: Math.round(elapsed),
      }

      sfx.correct(s.streak + 1)
      const pending = nextRound(graph, picked, s.streak + 1)

      clearTimeout(timeoutRef.current ?? undefined)
      timeoutRef.current = setTimeout(() => {
        const cur = stateRef.current
        if (cur.phase !== 'reveal' || !cur.pendingRound) return
        sfx.whoosh()
        armRoundTimer(cur.pendingRound.durationMs)
        setState({ ...cur, phase: 'round', round: cur.pendingRound, pendingRound: null, roundStartedAt: performance.now() })
      }, REVEAL_MS)

      setState({
        ...s,
        phase: 'reveal',
        score: s.score + points,
        streak: s.streak + 1,
        picks: s.picks + 1,
        history: [...s.history, link],
        lastLink: link,
        pendingRound: pending,
      })
    },
    [graph, nextRound, resolveMiss, armRoundTimer],
  )

  const timeout = useCallback(() => resolveMiss(null), [resolveMiss])

  const toMenu = useCallback(() => {
    clearTimeout(timeoutRef.current ?? undefined)
    clearTimeout(roundTimerRef.current ?? undefined)
    const s = stateRef.current
    setState(initialState({ score: s.bestScore, streak: s.bestStreak }))
  }, [])

  return { state, start, pickChoice, timeout, toMenu }
}
