/**
 * Builds the offline actor-connection graph from TMDB.
 *
 * Strategy: pull the most-voted movies across several eras (vote_count is a
 * good proxy for "audiences actually know this film"), fetch their credits,
 * and keep top-billed actors with profile photos who appear in at least
 * MIN_APPEARANCES movies within the set. The result is a compact JSON graph
 * the game loads once — gameplay makes zero API calls.
 *
 * Usage: node scripts/build-dataset.mjs
 * Reads TMDB_READ_TOKEN from env.local.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const TOKEN = readFileSync(resolve(ROOT, 'env.local'), 'utf8')
  .split('\n')
  .find((l) => l.startsWith('TMDB_READ_TOKEN='))
  ?.slice('TMDB_READ_TOKEN='.length)
  .trim()

if (!TOKEN) {
  console.error('TMDB_READ_TOKEN not found in env.local')
  process.exit(1)
}

const API = 'https://api.themoviedb.org/3'
const HEADERS = { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' }

const MAX_BILLING_ORDER = 10 // only top-billed cast — faces players might know
const MIN_APPEARANCES = 3 // actor must appear in >= N movies in the set
const CONCURRENCY = 12

async function get(path, params = {}) {
  const url = new URL(API + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${url.pathname}`)
    return res.json()
  }
  throw new Error(`rate-limited repeatedly: ${url.pathname}`)
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx], idx)
      }
    }),
  )
  return out
}

// --- 1. Collect movies: top-voted per era window + currently popular ---
const eraWindows = [
  { gte: '1960-01-01', lte: '1984-12-31', pages: 6 },
  { gte: '1985-01-01', lte: '1994-12-31', pages: 8 },
  { gte: '1995-01-01', lte: '2004-12-31', pages: 12 },
  { gte: '2005-01-01', lte: '2014-12-31', pages: 14 },
  { gte: '2015-01-01', lte: '2026-12-31', pages: 16 },
]

const movieMap = new Map()

function addDiscoverResults(results) {
  for (const m of results) {
    if (!m.poster_path || !m.release_date || m.adult) continue
    if (!movieMap.has(m.id)) {
      movieMap.set(m.id, {
        id: m.id,
        title: m.title,
        year: Number(m.release_date.slice(0, 4)),
        poster: m.poster_path,
        backdrop: m.backdrop_path ?? null,
        votes: m.vote_count,
        pop: m.popularity,
        genres: m.genre_ids ?? [],
        cast: [],
      })
    }
  }
}

console.log('Fetching movie lists...')
for (const w of eraWindows) {
  const pages = Array.from({ length: w.pages }, (_, i) => i + 1)
  const res = await mapLimit(pages, CONCURRENCY, (page) =>
    get('/discover/movie', {
      sort_by: 'vote_count.desc',
      'primary_release_date.gte': w.gte,
      'primary_release_date.lte': w.lte,
      'vote_count.gte': 1000,
      include_adult: false,
      page,
    }),
  )
  res.forEach((r) => addDiscoverResults(r.results))
}
// A few pages of currently-popular for fresh faces
const popPages = await mapLimit([1, 2, 3, 4], 4, (page) =>
  get('/discover/movie', { sort_by: 'popularity.desc', 'vote_count.gte': 500, include_adult: false, page }),
)
popPages.forEach((r) => addDiscoverResults(r.results))

const movies = [...movieMap.values()]
console.log(`Movies collected: ${movies.length}`)

// --- 2. Fetch credits, tally actor appearances ---
console.log('Fetching credits...')
const personTally = new Map() // id -> { person fields, count }
let done = 0
await mapLimit(movies, CONCURRENCY, async (movie) => {
  let credits
  try {
    credits = await get(`/movie/${movie.id}/credits`)
  } catch (e) {
    console.warn(`  skip credits for ${movie.title}: ${e.message}`)
    return
  }
  for (const c of credits.cast ?? []) {
    if (c.order >= MAX_BILLING_ORDER) continue
    if (!c.profile_path || c.known_for_department !== 'Acting') continue
    movie.cast.push(c.id)
    const entry = personTally.get(c.id)
    if (entry) {
      entry.count++
      entry.pop = Math.max(entry.pop, c.popularity)
    } else {
      personTally.set(c.id, { id: c.id, name: c.name, profile: c.profile_path, pop: c.popularity, count: 1 })
    }
  }
  if (++done % 200 === 0) console.log(`  credits ${done}/${movies.length}`)
})

// --- 3. Filter to actors with enough appearances; prune movies/casts ---
const keptPeople = [...personTally.values()].filter((p) => p.count >= MIN_APPEARANCES)
const keptIds = new Set(keptPeople.map((p) => p.id))

const finalMovies = movies
  .map((m) => ({ ...m, cast: m.cast.filter((id) => keptIds.has(id)) }))
  .filter((m) => m.cast.length >= 2) // a movie with <2 kept actors creates no edges

// Re-check people still appearing in final movies
const appearing = new Set(finalMovies.flatMap((m) => m.cast))
const finalPeople = keptPeople.filter((p) => appearing.has(p.id))

console.log(`Kept ${finalPeople.length} actors, ${finalMovies.length} movies`)

// --- 3.5 Full filmographies for distractor fairness ---
// A distractor must not be connected to the current actor through ANY shared
// screen credit — including movies outside our curated set and scripted TV
// (e.g. a co-starring miniseries) — or the round has two defensible answers.
// Talk-show/"Self" TV appearances are skipped or everyone shares Jimmy Kimmel.
// Encoding: movie id*2, tv id*2+1 (the two id spaces collide numerically).
console.log('Fetching combined credits for distractor exclusion...')
let creditsDone = 0
await mapLimit(finalPeople, CONCURRENCY, async (p) => {
  try {
    const combined = await get(`/person/${p.id}/combined_credits`)
    const ids = new Set()
    for (const c of combined.cast ?? []) {
      if (c.media_type === 'movie') ids.add(c.id * 2)
      else if (c.media_type === 'tv' && c.character && !/\bself\b/i.test(c.character)) ids.add(c.id * 2 + 1)
    }
    p.credits = [...ids].sort((a, b) => a - b)
  } catch (e) {
    console.warn(`  no credits for ${p.name}: ${e.message}`)
    p.credits = []
  }
  if (++creditsDone % 200 === 0) console.log(`  credits ${creditsDone}/${finalPeople.length}`)
})

// --- 4. Emit compact JSON (people/movies arrays, cast as people indices) ---
const personIndex = new Map(finalPeople.map((p, i) => [p.id, i]))
const dataset = {
  builtAt: new Date().toISOString(),
  imageBase: 'https://image.tmdb.org/t/p/',
  people: finalPeople.map((p) => ({
    id: p.id,
    name: p.name,
    profile: p.profile,
    pop: Math.round(p.pop * 10) / 10,
    credits: p.credits ?? [],
  })),
  movies: finalMovies.map((m) => ({
    id: m.id,
    title: m.title,
    year: m.year,
    poster: m.poster,
    backdrop: m.backdrop,
    votes: m.votes,
    genres: m.genres,
    cast: m.cast.map((id) => personIndex.get(id)),
  })),
}

const outPath = resolve(ROOT, 'public/data/graph.json')
writeFileSync(outPath, JSON.stringify(dataset))
console.log(`Wrote ${outPath} (${(JSON.stringify(dataset).length / 1024 / 1024).toFixed(2)} MB)`)
