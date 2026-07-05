/**
 * Round generation.
 *
 * Every round: pick a connected co-star (the correct answer), then 4
 * distractors that are provably NOT connected to the current actor but look
 * plausible — similar popularity rank and era to the correct answer.
 * All randomness flows through the seeded rng, so a given seed produces an
 * identical run (daily challenge).
 */
import type { Graph } from './dataset'
import { sharedMovies } from './dataset'
import type { Rng } from './rng'
import { randInt, shuffle } from './rng'

export interface Round {
  currentIdx: number
  /** 5 person indices, shuffled */
  choices: number[]
  correctPos: number
  /** shared movie indices between current and correct, best first */
  shared: number[]
  durationMs: number
}

const CHOICES = 5
const MIN_ONWARD_DEGREE = 5 // prefer correct answers that keep the chain alive

export function roundDuration(streak: number): number {
  // 20s at the start, ramping down to 12s by streak ~20
  return Math.round(Math.max(12000, 20000 - streak * 400))
}

/** Weighted toward famous faces so the run starts recognizable. */
export function pickStartActor(g: Graph, rng: Rng, exclude?: Set<number>): number {
  const pool = g.byPopularity.slice(0, 150).filter((p) => g.adj[p].size >= 10 && !exclude?.has(p))
  // Bias toward the top of the list: squaring skews the uniform sample low
  return pool[Math.floor(rng() ** 2 * pool.length)]
}

export function generateRound(
  g: Graph,
  rng: Rng,
  currentIdx: number,
  usedActors: Set<number>, // chain members — never valid choices again
  recentFaces: Set<number>, // recently shown distractors — avoid déjà vu
  streak: number,
): Round | null {
  const correct = pickCorrect(g, rng, currentIdx, usedActors, recentFaces)
  if (correct === null) return null

  const distractors = pickDistractors(g, rng, currentIdx, correct, usedActors, recentFaces)
  if (distractors.length < CHOICES - 1) return null

  const choices = shuffle(rng, [correct, ...distractors])
  return {
    currentIdx,
    choices,
    correctPos: choices.indexOf(correct),
    shared: sharedMovies(g, currentIdx, correct),
    durationMs: roundDuration(streak),
  }
}

function pickCorrect(
  g: Graph,
  rng: Rng,
  currentIdx: number,
  usedActors: Set<number>,
  recentFaces: Set<number>,
): number | null {
  const neighbors = [...g.adj[currentIdx]]
  // Relaxation tiers: ideal -> allow low onward degree -> allow recent faces
  const tiers = [
    neighbors.filter((p) => !usedActors.has(p) && !recentFaces.has(p) && g.adj[p].size >= MIN_ONWARD_DEGREE),
    neighbors.filter((p) => !usedActors.has(p) && !recentFaces.has(p)),
    neighbors.filter((p) => !usedActors.has(p)),
  ]
  for (const tier of tiers) {
    if (tier.length === 0) continue
    // Prefer more famous co-stars: sort by popularity, sample from the top half
    const sorted = tier.slice().sort((a, b) => g.people[b].pop - g.people[a].pop)
    const window = Math.max(1, Math.ceil(sorted.length / 2))
    return sorted[randInt(rng, window)]
  }
  return null
}

function pickDistractors(
  g: Graph,
  rng: Rng,
  currentIdx: number,
  correct: number,
  usedActors: Set<number>,
  recentFaces: Set<number>,
): number[] {
  const connected = g.adj[currentIdx]
  const currentCredits = g.allCredits[currentIdx]
  const correctRank = g.popRank[correct]
  const correctEra = g.era[correct]

  const eligible = (p: number) =>
    p !== currentIdx &&
    p !== correct &&
    !connected.has(p) && // never a valid answer within the curated graph...
    // ...and no shared credit anywhere on TMDB (other movies, scripted TV):
    // a co-star the player recognizes from outside our set must not be a trap
    !g.people[p].credits.some((id) => currentCredits.has(id)) &&
    !usedActors.has(p) &&
    g.people[p].name !== g.people[correct].name

  // Scan outward from the correct answer's popularity rank so distractors
  // "belong" in the same lineup, scoring by era proximity + jitter.
  const scored: { p: number; score: number }[] = []
  const total = g.byPopularity.length
  for (let offset = 1; offset < total && scored.length < 60; offset++) {
    for (const rank of [correctRank - offset, correctRank + offset]) {
      if (rank < 0 || rank >= total) continue
      const p = g.byPopularity[rank]
      if (!eligible(p)) continue
      const eraGap = Math.abs(g.era[p] - correctEra)
      const stale = recentFaces.has(p) ? 40 : 0
      scored.push({ p, score: offset * 0.3 + eraGap * 1.5 + stale + rng() * 25 })
    }
  }
  scored.sort((a, b) => a.score - b.score)
  const out: number[] = []
  const names = new Set<string>([g.people[correct].name])
  for (const { p } of scored) {
    if (names.has(g.people[p].name)) continue
    names.add(g.people[p].name)
    out.push(p)
    if (out.length === CHOICES - 1) break
  }
  return out
}
