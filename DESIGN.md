# COSTAR Design & Brand Language

The single source of truth for how COSTAR looks, sounds, and presents itself.
It serves three jobs:

1. **UI system reference** (§1–10) — the tokens, surfaces, motion, and component
   recipes behind the app, portable to any other project.
2. **Brand guide** (§11–14) — identity, voice, and application rules for the
   game's website, share cards, and promo materials.
3. **Portfolio framing** (§15) — how to present this project as a case study,
   including the AI-collaboration story.

Everything in §1–10 maps to real rules in `src/styles/global.css` — copy values
from this doc or lift whole blocks from that file.

## The idea in one paragraph

**Cinematic dark premium.** A near-black stage, one strongly lit focal point,
and warmth coming from *content* (imagery, gold light) rather than from bright
chrome. Panels feel like glass sitting above a deep scene; motion is springy
and brief; reward moments glow gold. Nothing is flat-design gray-on-white — the
depth is the identity.

---

## 1. Tokens

```css
:root {
  --bg: #0b0b12;            /* near-black with a violet cast — never pure #000 */
  --bg-raised: #14141f;     /* panels, cards, sheets */
  --text: #f2f0ea;          /* warm off-white, not #fff */
  --text-dim: #9a97a8;      /* secondary text, labels */
  --gold: #f5c542;          /* THE accent: success, focus, primary actions */
  --gold-soft: rgba(245, 197, 66, 0.35);  /* every gold glow uses this */
  --red: #ff5470;           /* failure, danger */
  --cyan: #53dfff;          /* secondary accent: info, links, "special" */
  --ring: rgba(255, 255, 255, 0.09);      /* hairline track/border tone */
  --radius: 14px;
  --font: 'Outfit', system-ui, -apple-system, sans-serif;
}
```

Rules of use:

- **Gold is earned.** It marks success, primary actions, and the current focus —
  if everything glows gold, nothing does. Secondary highlights get cyan.
- Text is warm off-white on violet-black; pure white and pure black both read
  as harsh here.
- Borders are almost always `1px solid rgba(255,255,255, 0.10–0.15)` — hairlines
  that catch light, not visible outlines.

## 2. Typography

- **One family, big weight contrast.** Outfit (Google Fonts) from 300–900.
  Hierarchy comes from weight (400 body → 800 headings → 900 display) and size,
  not from mixing families.
- **Display**: enormous, `font-weight: 900`, tight line-height (1–1.1), and for
  hero titles a vertical gradient fill:

  ```css
  .display {
    font-size: clamp(56px, 12vw, 96px);
    font-weight: 900;
    background: linear-gradient(180deg, #fff 20%, #cfc6a8 60%, var(--gold));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 60px var(--gold-soft);   /* the glow lives behind the fill */
  }
  ```

- **Kickers/labels**: tiny, uppercase, widely tracked — this is the signature
  secondary style. `font-size: 10–12px; letter-spacing: 0.22–0.35em;
  text-transform: uppercase; color: var(--text-dim)`.
- **Numbers**: `font-variant-numeric: tabular-nums` anywhere values change in
  place (scores, counters), so digits don't jitter.
- All sizes that matter use `clamp(min, viewport-unit, max)` — the layout
  scales fluidly instead of jumping at breakpoints.

## 3. Background & depth

The scene is built from stacked fixed layers (back to front):

1. **Gradient wash** — two huge, dim radial gradients (violet top, teal bottom
   corner) over `--bg`. This alone kills the "flat black page" look:

   ```css
   background:
     radial-gradient(1200px 600px at 50% -10%, rgba(90,70,160,.25), transparent 60%),
     radial-gradient(900px 500px at 85% 110%, rgba(30,90,130,.18), transparent 60%),
     var(--bg);
   ```

2. **Ambient imagery** — a content image (here: movie backdrops) at low opacity,
   heavily blurred and darkened, slowly zooming over ~20s
   (`filter: blur(14px) brightness(.55); opacity: .32; transform: scale(1 → 1.09)`).
   For a portfolio: screenshots of your work, a photo, generative texture.
3. **Floaters** — small images drifting slowly upward at 15–25% opacity with
   slight blur and rotation. Decorative memory of what the user has done.
4. **Vignette** — `radial-gradient(ellipse at center, transparent 55%,
   rgba(5,5,10,.75) 100%)` pulls the eye centerward and hides layer edges.

Content sits above all of this at `z-index: 1`; the layers are `position: fixed`
and `pointer-events: none` where applicable.

## 4. Surfaces

**Raised panel** (end screens, modals):

```css
.panel {
  background: rgba(16, 16, 26, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  backdrop-filter: blur(14px);            /* glass: the scene bleeds through */
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);   /* deep, soft, low */
}
```

**Interactive card**:

```css
.card {
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius);
  backdrop-filter: blur(8px);
  transition: transform .14s, border-color .14s, box-shadow .14s;
}
.card:hover {
  transform: translateY(-5px) scale(1.03);
  border-color: var(--gold);
  box-shadow: 0 12px 34px rgba(0,0,0,.5), 0 0 24px rgba(245,197,66,.18);
}
```

The hover formula — *lift + slight scale + gold border + gold bloom* — is used
on every clickable card in the app. Keep it under 150ms.

**Bottom sheet** (mobile-friendly detail views): panel pinned to the bottom
edge, `border-radius: 20px 20px 0 0`, sliding up 60px with fade over ~320ms.

## 5. Glow recipes

Glow is the reward language. Three intensities, all built on `--gold-soft`:

```css
/* ambient presence */   box-shadow: 0 0 22px var(--gold-soft);
/* selected/correct */   box-shadow: 0 0 0 2px var(--gold), 0 0 44px var(--gold-soft);
/* hero text */          text-shadow: 0 0 60px var(--gold-soft);
```

A slow `@keyframes` pulse (scale 1 → 1.035, or shadow 22px → 34px, ~2s
ease-in-out infinite) marks "this is your goal / pay attention here".
Failure swaps gold for `--red` with the same structure.

## 6. Motion

Two easing personalities, used everywhere:

```css
/* springy pop — entrances, rewards (overshoots slightly) */
cubic-bezier(0.2, 1.2, 0.4, 1)      /* variants up to (0.2, 1.5, …) for punchier */
/* smooth settle — hovers, fades */
ease / ease-out, 140–250ms
```

Patterns:

- **Staggered entrance**: children animate in with `animation-delay:
  calc(index * 55ms)`, rising ~26px with fade + slight scale-up, 400ms.
  This makes any list feel choreographed.
- **Value pop**: when a number changes, remount it (`key={value}` in React) with
  a 350ms scale-from-1.25 + gold flash. Tactile without layout shift.
- **Punch-in** for success: `scale 1 → 1.08 → 1.02` over 400ms.
- **Shake** for errors: ±9px decaying horizontal shake, 450ms.
- **Reveal moments are skippable**: long enough to read (2.5–4s), but any
  tap/keypress advances. Never trap fast users in your choreography.
- **Gotcha**: `animation-fill-mode` (`forwards`/`backwards`) overrides class
  opacity — if a later state must change opacity, set `animation: none` in that
  state's rule.

**Reduced motion** is a hard kill switch, honored from both OS preference and
an in-app toggle, via a data attribute on `<html>`:

```css
[data-motion='reduced'] *, ::before, ::after {
  animation-duration: 0.001s !important;
  transition-duration: 0.001s !important;
}
```

## 7. Components

**Primary button** — the only loud element on screen:

```css
.btn-primary {
  background: linear-gradient(180deg, #ffd968, var(--gold) 60%, #d9a520);
  color: #201a05;                       /* dark text ON gold, never white */
  border: none;
  border-radius: 12px;
  padding: 14px 28px;
  font-weight: 600;
  box-shadow: 0 4px 26px var(--gold-soft);
}
```

**Ghost button** — everything else: `--bg-raised` fill, hairline border,
hover = lift 2px + brighter border. No color.

**Stat block** — the HUD pattern: kicker label on top, big tabular number
below. Works for any dashboard-ish info.

**Chip/badge** — pill radius (999px), 10–11px bold uppercase; gold-filled with
dark text for achievements ("New best!"), hairline-bordered dim for meta info.

**Avatar/thumb** — circular, `object-fit: cover`, hairline ring
(`box-shadow: 0 0 0 1px rgba(255,255,255,.2)`); active state upgrades the ring
to 2px gold + bloom. Initials on `#23233a` as the image fallback.

**Poster shelf** — horizontally scrolling rows, `scroll-snap-type: x proximity`,
hidden scrollbars, cards using the hover-lift formula. The whole scroll area
gets a vertical fade mask so content dissolves at the edges instead of
clipping:

```css
mask: linear-gradient(180deg, transparent, #000 18px, #000 calc(100% - 12px), transparent);
```

## 8. Layout rules

- Single-purpose screens, one focal point, generous vertical rhythm from
  `gap: clamp(...)` on flex columns — not margin soup.
- **Centering trick that prevents mobile overflow**: any full-screen
  grid-centering wrapper needs `grid-template-columns: minmax(0, 1fr)`;
  an implicit `auto` track sizes to max-content and lets panels bleed off
  narrow screens.
- Card grids use `repeat(auto-fit, minmax(min, max))` so partial rows stay
  centered.
- Mobile: grids of cards become full-width rows (thumb targets ≥ 56px tall);
  decorative side elements hide or shrink below ~960px; keyboard hints hide on
  touch.
- `body { overflow: hidden }` app-shell with internal scroll areas — the frame
  never scrolls, content areas do.

## 9. Sound (optional but cheap)

All SFX are WebAudio-synthesized — zero asset files (`src/audio/sfx.ts`).
The vocabulary: short sine chimes that **rise in pitch with progress**
(momentum you can hear), sawtooth slide-down for failure, a 30ms square blip
for urgency ticks, band-passed noise sweeps for transitions, and a ~2s master
gain at 0.5 so nothing ever startles. Every effect < 0.5s.

## 10. Porting checklist (e.g., a portfolio)

1. Copy the `:root` tokens and the Outfit font link; keep gold-as-reward or
   swap `--gold` for your brand accent (keep the `-soft` alpha variant).
2. Build the background: gradient wash + one blurred ambient image of your own
   content + vignette. This is 80% of the vibe.
3. Set type styles: gradient display headline, uppercase tracked kickers,
   weight-based hierarchy.
4. Use raised-glass panels for content sections and the hover-lift formula for
   anything clickable (project cards ≈ choice cards; a project detail sheet ≈
   the cast bottom-sheet).
5. Add staggered entrances on scroll/mount, the two easing curves, and the
   reduced-motion kill switch.
6. Keep one primary gold button per view; everything else ghost.

---

# Part two: Brand

## 11. Identity

**Name**: COSTAR — always uppercase in display contexts. The name is the
mechanic: every round is about who starred *with* whom.

**Wordmark**: `CO★STAR` — the star glyph replaces the hyphen and sits slightly
raised (`font-size: 0.55em; vertical-align: 0.22em`), rendered in solid gold
while the letters carry the white→gold gradient fill (§2). The ★ alone is the
brandmark: favicon, avatar, loading spinner, bullet. It reads at any size and
costs nothing to reproduce.

**Tagline hierarchy**:

- Primary: *The movie connection game* (category-defining, used as the kicker
  above the wordmark)
- Narrative: *Every star is connected. Prove it.* (hero copy, trailers)
- Mode hooks: *Six hops. One destination.* (Journey) · *One real co-star.
  Forever.* (Survival)

**The visual signature** in one sentence: a dark theater where faces are lit
like portraits, connections draw themselves in gold light, and the movies
themselves supply all the color.

## 12. Voice & copy

COSTAR speaks like a knowledgeable friend at a movie night — warm, brisk,
a little cinematic, never snarky. Rules, with real strings from the game:

- **Say it in one breath.** "Who shares a movie with…", "Together in",
  "Where does your journey begin?"
- **Failure gets drama, not blame.** "The trail went cold", "Time ran out
  mid-route", "Journey lost" — the *trail* failed, never "you failed".
- **Reward discovery over score.** "Deepest cut", "🧭 Found them",
  "+2 more films together" — the copy celebrates knowledge, not points.
- **Direct address, present tense, second person.** "now do it in 6",
  "Start your journey as…"
- **Emoji as iconography, not decoration**: a small fixed vocabulary with
  assigned meanings — 🔥 closer · 〰️ sideways · ❄️ further · 🎯 arrived at
  par · 🧭 found beyond budget · 🎬 the brand prefix in share text. Never
  introduce emoji outside this vocabulary.

## 13. Applications

**Website hero**: the menu screen *is* the brand layout — kicker, gradient
wordmark, one-sentence promise, single gold CTA. Reuse it verbatim: dark stage,
vignette, drifting posters behind, `CO★STAR` at `clamp(56px, 12vw, 96px)`.

**Share/social cards**: follow the share-text structure (🎬 header, route line,
verdict line, warmth trail). Visually: `--bg` field, two circular portraits
joined by the gold beam (§5's "selected" glow on both), verdict in Outfit 800,
warmth emoji row as the footer. The beam-between-portraits image is the most
brandable single frame the game produces — it's the "match moment" and should
be the default promo image.

**Promo screenshots**: capture at reveal or victory moments (the emotional
peaks), always on the dark stage, never cropped so tight the vignette
disappears. Motion GIFs should show one full pick→reveal beat (~4s) and stop.

**Anything print/light-background**: the wordmark inverts to near-black
`#0b0b12` letters with the gold star unchanged; the gradient fill is
screen-only.

## 14. Licensing boundary for promo materials

This is the hard rule that shapes all marketing assets:

- Posters, backdrops, and actor photos come from TMDB. In-app use runs under
  the TMDB API terms with the required attribution — but **promo materials are
  a different context**. Marketing that reproduces TMDB imagery (or actor
  likenesses) is not covered by the free API license and actor images carry
  personality rights on top.
- Therefore: **promo materials use only original brand elements** — wordmark,
  star, gold beam, warmth emoji, the dark stage, and *abstract* stand-ins for
  content (blurred silhouettes, empty portrait rings joined by the beam, generic
  poster-shaped gold rectangles). This constraint is on-brand anyway: the empty
  gold-ringed portrait circle joined by a beam reads instantly as "connection"
  without any licensed face.
- Screenshots of the actual running app (which carry TMDB attribution in
  context) are the one sanctioned way real movie imagery appears in promo use,
  and the free tier remains non-commercial — a commercial launch needs a TMDB
  commercial license first.

## 15. Portfolio framing

As a case study, the strongest beats to present (each is documented in
README/git history):

1. **Data strategy** — TMDB mined offline into a 1 MB precomputed graph;
   zero API calls at play time.
2. **Fairness as engineering** — the Bernthal/Thompson trap (a TV miniseries
   outside the movie graph) and its fix: distractors screened against actors'
   complete real-world credits, then *proven* with 800 simulated rounds.
3. **Game feel as system** — the design language in this document; reward
   choreography, warmth feedback, drift-assist rubber-banding.
4. **Branding** — this brand layer: identity, voice, licensing-aware promo
   rules.
5. **Working with AI** — the game was designed and built in collaboration with
   an AI pair (Claude), with the human directing product taste: the six-link
   goal, retry-to-beat-par, free roam, "let players *read* the connection".
   Present it as direction + verification, not delegation: every mechanic was
   play-tested, and the fairness claims were checked by simulation. Suggested
   credit line: *"Designed and directed by Vincent Ang, built in collaboration
   with Claude (Anthropic)."*

