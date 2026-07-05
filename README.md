# COSTAR — movie connection survival

A survival-mode arcade game inspired by Six Degrees of Kevin Bacon. One actor is on
screen; five faces appear below. Exactly one of them shares a movie credit with the
current actor. Pick the co-star before the timer runs out, and the chain continues
with your pick as the new current actor. One miss ends the run.

## Running it

```sh
npm install
npm run dataset   # one-time: builds public/data/graph.json from TMDB (needs env.local)
npm run dev       # play at the printed localhost URL
```

`env.local` must contain `TMDB_READ_TOKEN=<v4 read access token>`. The token is only
used by the offline dataset script — the game itself makes **zero API calls**; it
loads the prebuilt graph and pulls images straight from TMDB's CDN.

## How it works

- `scripts/build-dataset.mjs` pulls ~1,100 of the most-voted movies across five era
  windows (1960→today) plus currently-popular titles, fetches their credits, and keeps
  top-billed actors with profile photos who appear in ≥3 movies of the set. Output is a
  compact `graph.json` (~0.3 MB): people, movies, and each movie's cast as indices.
- `src/lib/dataset.ts` builds the adjacency structures at load time (actor↔actor edges,
  filmographies, popularity ranks, era medians).
- `src/lib/rounds.ts` generates rounds: the correct answer is a real co-star (biased
  toward famous, well-connected ones); the four distractors are provably *not*
  connected to the current actor but sit in the same popularity band and era as the
  correct answer, so they look plausible.
- `src/game/useGame.ts` is the run state machine:
  `menu → round → reveal → round → … → miss → gameover`.
  All randomness flows through a seeded RNG, so the **Daily Challenge** (seeded from
  the date) is the same board for everyone.
- Scoring: `(100 + time-bonus + deep-cut bonus) × streak multiplier`. Deep cuts are
  shared movies under 4,000 TMDB votes. The multiplier grows +0.1 per streak, capped ×3.
- Sound is synthesized with WebAudio (no assets); the correct-answer chime rises in
  pitch as the streak grows.

## Structure

```
scripts/build-dataset.mjs   offline TMDB → graph.json
public/data/graph.json      prebuilt dataset
src/
  lib/       rng, dataset/graph, round generation (pure logic)
  game/      state machine hook, types, settings
  audio/     WebAudio sfx synth
  components/ screens + pieces (Start, Game, Match overlay, GameOver, Background)
  styles/    single global stylesheet, dark cinematic theme
```

## TMDB attribution & licensing

This product uses the TMDB API but is not endorsed or certified by TMDB. Data and
images courtesy of [TMDB](https://www.themoviedb.org). The free TMDB API license is
for **non-commercial use** — commercial release requires a separate TMDB license.
The in-game About screen carries the required notice and logo.
