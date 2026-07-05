/**
 * Wordle-style shareable result text. Uses the native share sheet where
 * available (mobile), falls back to the clipboard.
 */
import type { Graph } from './dataset'
import type { GameState } from '../game/types'

const WARMTH_EMOJI = { closer: '🔥', same: '〰️', further: '❄️' } as const

function dateStamp(): string {
  return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function buildShareText(g: Graph, s: GameState): string {
  if (s.journey) {
    const start = g.people[s.journey.startIdx].name
    const target = g.people[s.journey.targetIdx].name
    const trail = s.history.map((l) => WARMTH_EMOJI[l.warmth ?? 'same']).join('')
    const daily = s.mode === 'daily-journey' ? ` — ${dateStamp()}` : ''
    const outcome =
      s.phase === 'victory'
        ? s.journey.freeRoam
          ? `🧭 Found in ${s.history.length} · Par ${s.journey.par} · over budget`
          : `✅ Linked in ${s.history.length} · Par ${s.journey.par}`
        : `❌ Lost the trail · Par ${s.journey.par}`
    return `🎬 COSTAR Journey${daily}\n${start} → ${target}\n${outcome}\n${trail}`
  }
  const daily = s.mode === 'daily' ? ` — ${dateStamp()}` : ''
  return `🎬 COSTAR Survival${daily}\nChain of ${s.streak} · ${s.score.toLocaleString()} pts`
}

/** Returns 'shared' | 'copied' so the UI can confirm what happened. */
export async function shareResult(text: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch {
      // fall through to clipboard (user cancelled or share failed)
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
