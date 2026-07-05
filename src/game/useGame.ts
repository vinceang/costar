/**
 * Game orchestration hook: owns the run state machine and all transitions.
 *
 * Survival:  menu -> round -> reveal -> round -> ... -> miss -> gameover
 * Journey:   menu -> round -> reveal -> round -> ... -> victory | gameover
 *
 * In journey mode every choice is a real co-star, so picks never "miss" —
 * the run ends by arrival, by running out of links, by the destination
 * becoming unreachable in the links remaining, or by timeout.
 *
 * Round generation is synchronous against the in-memory graph, so the next
 * round is built the moment a pick lands and its images preload behind the
 * reveal overlay. All impure work (rng, sfx, timers) happens in event
 * handlers — state updaters stay pure for StrictMode safety.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Graph } from '../lib/dataset'
import { imageUrl, sharedMovies } from '../lib/dataset'
import type { Rng } from '../lib/rng'
import { createRng, hashString } from '../lib/rng'
import type { Round } from '../lib/rounds'
import { generateRound, pickStartActor } from '../lib/rounds'
import type { JourneyPair } from '../lib/journey'
import {
  MAX_LINKS,
  freeRoamChoiceCount,
  generateJourneyRound,
  makePair,
  pickJourneyPair,
  warmthOf,
} from '../lib/journey'
import { sfx } from '../audio/sfx'
import type { ChainLink, GameState, Mode } from './types'

// Reveals auto-advance slowly enough to actually read the connection, and a
// tap/keypress skips ahead for players who don't need the time.
export const SURVIVAL_REVEAL_MS = 2400
export const JOURNEY_REVEAL_MS = 3600
export const MISS_MS = 2400
const RECENT_FACES_WINDOW = 40
const DEEP_CUT_VOTES = 4000

const BEST_KEY = 'costar.best'
const ROUTES_KEY = 'costar.routes'

function loadBest(): { score: number; streak: number } {
  try {
    return { score: 0, streak: 0, ...JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') }
  } catch {
    return { score: 0, streak: 0 }
  }
}

/** Per-route personal bests, keyed by TMDB person ids "startId>targetId". */
function routeKey(g: Graph, startIdx: number, targetIdx: number): string {
  return `${g.people[startIdx].id}>${g.people[targetIdx].id}`
}

function loadRouteBest(g: Graph, startIdx: number, targetIdx: number): number | null {
  try {
    const routes = JSON.parse(localStorage.getItem(ROUTES_KEY) ?? '{}')
    return routes[routeKey(g, startIdx, targetIdx)] ?? null
  } catch {
    return null
  }
}

function saveRouteBest(g: Graph, startIdx: number, targetIdx: number, links: number) {
  try {
    const routes = JSON.parse(localStorage.getItem(ROUTES_KEY) ?? '{}')
    routes[routeKey(g, startIdx, targetIdx)] = links
    localStorage.setItem(ROUTES_KEY, JSON.stringify(routes))
  } catch {
    // storage full/blocked: route bests are a nicety, not critical
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
    journey: null,
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
  const journeyPairRef = useRef<JourneyPair | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Authoritative round clock: the TimerRing's rAF loop is display-only and
  // pauses in background tabs, so expiry must be enforced here too.
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The pending reveal->next transition, so a tap can run it early
  const advanceRef = useRef<(() => void) | null>(null)

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

  const savedBest = useCallback((s: GameState) => {
    // Journey results don't compete with survival scores
    if (s.journey) return { bestScore: s.bestScore, bestStreak: s.bestStreak, newBest: false }
    const bestScore = Math.max(s.bestScore, s.score)
    const bestStreak = Math.max(s.bestStreak, s.streak)
    const newBest = s.score > s.bestScore && s.score > 0
    localStorage.setItem(BEST_KEY, JSON.stringify({ score: bestScore, streak: bestStreak }))
    return { bestScore, bestStreak, newBest }
  }, [])

  /** Survival: generate a round from `from`; teleport if the chain is boxed in. */
  const nextSurvivalRound = useCallback((g: Graph, from: number, streak: number): Round => {
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

  /** Journey rounds reuse the Round shape; correctPos -1 = "no trap answers". */
  const nextJourneyRound = useCallback((g: Graph, from: number, choiceCount = 5): Round => {
    const jr = generateJourneyRound(g, rngRef.current, from, journeyPairRef.current!, usedActors.current, choiceCount)
    const round: Round = { ...jr, correctPos: -1, shared: [] }
    preloadRound(g, round)
    return round
  }, [])

  const resolveMiss = useCallback(
    (pickedPos: number | null) => {
      const s = stateRef.current
      if (s.phase !== 'round' || !s.round) return
      clearTimeout(roundTimerRef.current ?? undefined)

      if (s.journey) {
        // Journey timeout: no wrong answer to reveal — straight to the summary
        sfx.gameover()
        setState({
          ...s,
          phase: 'gameover',
          picks: s.picks + 1,
          journey: { ...s.journey, failReason: 'timeout' },
          ...savedBest(s),
        })
        return
      }

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
        setState({ ...cur, phase: 'gameover', ...savedBest(cur) })
      }, MISS_MS)
    },
    [savedBest],
  )

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
    (mode: Mode, opts?: { startIdx?: number; route?: { startIdx: number; targetIdx: number } }) => {
      if (!graph) return
      clearTimeout(timeoutRef.current ?? undefined)
      const isDaily = mode === 'daily' || mode === 'daily-journey'
      const isJourney = mode === 'journey' || mode === 'daily-journey'
      const seed = isDaily ? dailySeed() : (Math.random() * 2 ** 32) >>> 0
      rngRef.current = createRng(isJourney && isDaily ? seed ^ 0x6a6f7572 : seed)
      usedActors.current = new Set()
      recentFaces.current = []

      const base = {
        ...initialState({ score: stateRef.current.bestScore, streak: stateRef.current.bestStreak }),
        phase: 'round' as const,
        mode,
        seed,
        roundStartedAt: performance.now(),
      }

      if (isJourney) {
        const pair = opts?.route
          ? makePair(graph, opts.route.startIdx, opts.route.targetIdx)
          : pickJourneyPair(graph, rngRef.current, opts?.startIdx)
        journeyPairRef.current = pair
        usedActors.current.add(pair.startIdx)
        const round = nextJourneyRound(graph, pair.startIdx)
        // Preload the destination portrait for the progress rail
        const targetUrl = imageUrl(graph, graph.people[pair.targetIdx].profile, 'w185')
        if (targetUrl) new Image().src = targetUrl
        sfx.whoosh()
        armRoundTimer(round.durationMs)
        setState({
          ...base,
          round,
          journey: {
            startIdx: pair.startIdx,
            targetIdx: pair.targetIdx,
            par: pair.par,
            maxLinks: MAX_LINKS,
            distNow: pair.dist[pair.startIdx],
            failReason: null,
            routeBest: loadRouteBest(graph, pair.startIdx, pair.targetIdx),
            newRouteBest: false,
            freeRoam: false,
            drift: 0,
          },
        })
        return
      }

      journeyPairRef.current = null
      const startActor = pickStartActor(graph, rngRef.current)
      usedActors.current.add(startActor)
      const round = nextSurvivalRound(graph, startActor, 0)
      sfx.whoosh()
      armRoundTimer(round.durationMs)
      setState({ ...base, round })
    },
    [graph, nextSurvivalRound, nextJourneyRound, armRoundTimer],
  )

  const journeyPick = useCallback(
    (pos: number) => {
      const s = stateRef.current
      const pair = journeyPairRef.current
      if (!graph || !pair || !s.journey || s.phase !== 'round' || !s.round) return
      const freeRoam = s.journey.freeRoam
      const elapsed = performance.now() - s.roundStartedAt
      if (!freeRoam && elapsed > s.round.durationMs + 250) {
        resolveMiss(null)
        return
      }
      clearTimeout(roundTimerRef.current ?? undefined)

      const picked = s.round.choices[pos]
      const shared = sharedMovies(graph, s.round.currentIdx, picked)
      const warmth = warmthOf(pair, s.round.currentIdx, picked)
      const linksUsed = s.history.length + 1
      const arrived = picked === pair.targetIdx
      const distNow = pair.dist[picked]

      const link: ChainLink = {
        fromIdx: s.round.currentIdx,
        toIdx: picked,
        movieIdx: shared[0],
        extraShared: shared.length - 1,
        points: 0,
        ms: Math.round(elapsed),
        warmth,
        sharedAll: shared.slice(0, 4),
      }

      usedActors.current.add(picked)
      if (arrived) sfx.correct(8)
      else if (warmth === 'closer') sfx.correct(linksUsed)
      else sfx.whoosh()

      const outOfLinks = !freeRoam && !arrived && linksUsed >= s.journey.maxLinks
      const unreachable = !freeRoam && !arrived && distNow > s.journey.maxLinks - linksUsed
      const nextPhase = arrived ? 'victory' : outOfLinks || unreachable ? 'gameover' : 'round'
      // Recovery is gradual from the floor: a closer hop at 2 choices climbs
      // back to 3 (drift 2), not straight to 4; anywhere above that resets.
      const drift = freeRoam
        ? warmth === 'closer'
          ? s.journey.drift >= 3
            ? 2
            : 0
          : s.journey.drift + 1
        : 0
      const pending =
        nextPhase === 'round'
          ? nextJourneyRound(graph, picked, freeRoam ? freeRoamChoiceCount(drift) : 5)
          : null

      const advance = () => {
        const cur = stateRef.current
        if (cur.phase !== 'reveal' || !cur.journey) return
        advanceRef.current = null
        if (nextPhase === 'round' && cur.pendingRound) {
          sfx.whoosh()
          if (!cur.journey.freeRoam) armRoundTimer(cur.pendingRound.durationMs)
          setState({ ...cur, phase: 'round', round: cur.pendingRound, pendingRound: null, roundStartedAt: performance.now() })
        } else {
          if (nextPhase === 'gameover') sfx.gameover()
          let routeBest = cur.journey.routeBest
          let newRouteBest = false
          // Route bests are earned within the link budget only
          if (nextPhase === 'victory' && !cur.journey.freeRoam) {
            const links = cur.history.length
            newRouteBest = routeBest === null || links < routeBest
            if (newRouteBest) {
              routeBest = links
              saveRouteBest(graph, cur.journey.startIdx, cur.journey.targetIdx, links)
            }
          }
          setState({
            ...cur,
            phase: nextPhase,
            journey: {
              ...cur.journey,
              failReason: nextPhase === 'gameover' ? (outOfLinks ? 'links' : 'unreachable') : null,
              routeBest,
              newRouteBest,
            },
            ...savedBest(cur),
          })
        }
      }
      advanceRef.current = advance
      clearTimeout(timeoutRef.current ?? undefined)
      timeoutRef.current = setTimeout(advance, JOURNEY_REVEAL_MS)

      setState({
        ...s,
        phase: 'reveal',
        picks: s.picks + 1,
        streak: linksUsed,
        history: [...s.history, link],
        lastLink: link,
        pendingRound: pending,
        journey: { ...s.journey, distNow, drift },
      })
    },
    [graph, nextJourneyRound, resolveMiss, armRoundTimer, savedBest],
  )

  const pickChoice = useCallback(
    (pos: number) => {
      const s = stateRef.current
      if (!graph || s.phase !== 'round' || !s.round) return
      if (s.journey) {
        journeyPick(pos)
        return
      }
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
        sharedAll: round.shared.slice(0, 4),
      }

      sfx.correct(s.streak + 1)
      const pending = nextSurvivalRound(graph, picked, s.streak + 1)

      const advance = () => {
        const cur = stateRef.current
        if (cur.phase !== 'reveal' || !cur.pendingRound) return
        advanceRef.current = null
        sfx.whoosh()
        armRoundTimer(cur.pendingRound.durationMs)
        setState({ ...cur, phase: 'round', round: cur.pendingRound, pendingRound: null, roundStartedAt: performance.now() })
      }
      advanceRef.current = advance
      clearTimeout(timeoutRef.current ?? undefined)
      timeoutRef.current = setTimeout(advance, SURVIVAL_REVEAL_MS)

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
    [graph, nextSurvivalRound, resolveMiss, armRoundTimer, journeyPick],
  )

  const timeout = useCallback(() => resolveMiss(null), [resolveMiss])

  /** Tap/keypress during a reveal: run the pending transition immediately. */
  const skipReveal = useCallback(() => {
    if (stateRef.current.phase !== 'reveal') return
    clearTimeout(timeoutRef.current ?? undefined)
    advanceRef.current?.()
  }, [])

  /** Post-loss journey continuation: no timer, no budget, ends on arrival. */
  const continueFreeRoam = useCallback(() => {
    const s = stateRef.current
    const pair = journeyPairRef.current
    if (!graph || !pair || !s.journey || s.phase !== 'gameover') return
    const position = s.history.length ? s.history[s.history.length - 1].toIdx : s.journey.startIdx
    const round = nextJourneyRound(graph, position, freeRoamChoiceCount(0))
    sfx.whoosh()
    setState({
      ...s,
      phase: 'round',
      round,
      pendingRound: null,
      roundStartedAt: performance.now(),
      miss: null,
      journey: { ...s.journey, freeRoam: true, failReason: null, drift: 0 },
    })
  }, [graph, nextJourneyRound])

  const toMenu = useCallback(() => {
    clearTimeout(timeoutRef.current ?? undefined)
    clearTimeout(roundTimerRef.current ?? undefined)
    const s = stateRef.current
    setState(initialState({ score: s.bestScore, streak: s.bestStreak }))
  }, [])

  return { state, start, pickChoice, timeout, toMenu, skipReveal, continueFreeRoam }
}
