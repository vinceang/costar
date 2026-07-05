/**
 * Dataset loading and graph construction.
 *
 * The raw JSON (built offline by scripts/build-dataset.mjs) holds people and
 * movies; every movie lists its top-billed cast as people indices. At load
 * time we derive the actor-adjacency structures the game queries every round.
 */

export interface Person {
  id: number
  name: string
  profile: string
  pop: number
  /**
   * Every screen credit on TMDB (movies + scripted TV), encoded id*2 for
   * movies / id*2+1 for TV. Used only to disqualify distractors that share
   * any real-world credit with the current actor — including titles outside
   * the curated movie set.
   */
  credits: number[]
}

export interface Movie {
  id: number
  title: string
  year: number
  poster: string
  backdrop: string | null
  votes: number
  genres: number[] // TMDB genre ids
  cast: number[] // indices into people
}

/** TMDB movie genre ids -> display names (stable public ids), in shelf order. */
export const GENRES: [number, string][] = [
  [28, 'Action'],
  [35, 'Comedy'],
  [18, 'Drama'],
  [878, 'Sci-Fi'],
  [27, 'Horror'],
  [16, 'Animation'],
  [80, 'Crime'],
  [10749, 'Romance'],
  [53, 'Thriller'],
  [14, 'Fantasy'],
]

interface RawDataset {
  imageBase: string
  people: Person[]
  movies: Movie[]
}

export interface Graph {
  imageBase: string
  people: Person[]
  movies: Movie[]
  /** person index -> set of connected person indices */
  adj: Set<number>[]
  /** person index -> movie indices they appear in */
  filmography: number[][]
  /** person index -> median year of their movies (era matching for distractors) */
  era: number[]
  /** person indices sorted by popularity desc (distractor rank windows) */
  byPopularity: number[]
  /** rank in byPopularity for each person index */
  popRank: number[]
  /** person index -> full encoded credit set (see Person.credits) */
  allCredits: Set<number>[]
}

export async function loadGraph(): Promise<Graph> {
  const res = await fetch('/data/graph.json')
  if (!res.ok) throw new Error(`Failed to load dataset (${res.status})`)
  const raw: RawDataset = await res.json()
  return buildGraph(raw)
}

export function buildGraph(raw: RawDataset): Graph {
  const n = raw.people.length
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set())
  const filmography: number[][] = Array.from({ length: n }, () => [])

  raw.movies.forEach((movie, mi) => {
    for (const p of movie.cast) filmography[p].push(mi)
    for (let i = 0; i < movie.cast.length; i++) {
      for (let j = i + 1; j < movie.cast.length; j++) {
        adj[movie.cast[i]].add(movie.cast[j])
        adj[movie.cast[j]].add(movie.cast[i])
      }
    }
  })

  const era = filmography.map((movies) => {
    const years = movies.map((mi) => raw.movies[mi].year).sort((a, b) => a - b)
    return years.length ? years[Math.floor(years.length / 2)] : 2000
  })

  const byPopularity = raw.people
    .map((_, i) => i)
    .sort((a, b) => raw.people[b].pop - raw.people[a].pop)
  const popRank = new Array<number>(n)
  byPopularity.forEach((personIdx, rank) => (popRank[personIdx] = rank))

  const allCredits = raw.people.map((p) => new Set(p.credits ?? []))

  return {
    imageBase: raw.imageBase,
    people: raw.people,
    movies: raw.movies,
    adj,
    filmography,
    era,
    byPopularity,
    popRank,
    allCredits,
  }
}

/** Movie indices shared by two actors, best (most-voted) first. */
export function sharedMovies(g: Graph, a: number, b: number): number[] {
  const inB = new Set(g.filmography[b])
  return g.filmography[a]
    .filter((mi) => inB.has(mi))
    .sort((x, y) => g.movies[y].votes - g.movies[x].votes)
}

export type ImageSize = 'w185' | 'w342' | 'w500' | 'w780'

export function imageUrl(g: Graph, path: string | null, size: ImageSize): string | null {
  return path ? `${g.imageBase}${size}${path}` : null
}
