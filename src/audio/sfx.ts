/**
 * All sound is synthesized with WebAudio — no audio assets to load.
 * Every effect is short and mixed quiet; the correct-answer chime rises in
 * pitch with the streak so combos are audible.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

export function setMuted(m: boolean) {
  muted = m
}

function ensure(): AudioContext | null {
  if (muted) return null
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  freq: number,
  opts: { type?: OscillatorType; dur?: number; gain?: number; delay?: number; slideTo?: number } = {},
) {
  const c = ensure()
  if (!c || !master) return
  const { type = 'sine', dur = 0.18, gain = 0.25, delay = 0, slideTo } = opts
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function noise(opts: { dur?: number; gain?: number; delay?: number; from?: number; to?: number } = {}) {
  const c = ensure()
  if (!c || !master) return
  const { dur = 0.25, gain = 0.12, delay = 0, from = 400, to = 3000 } = opts
  const t0 = c.currentTime + delay
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(from, t0)
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(g).connect(master)
  src.start(t0)
}

export const sfx = {
  /** Rising two-note chime + sparkle; pitch climbs with streak. */
  correct(streak: number) {
    const semi = Math.min(streak, 12)
    const base = 523.25 * Math.pow(2, semi / 24)
    tone(base, { dur: 0.14, gain: 0.22 })
    tone(base * 1.5, { dur: 0.22, gain: 0.22, delay: 0.09 })
    tone(base * 2, { type: 'triangle', dur: 0.35, gain: 0.1, delay: 0.16 })
    noise({ dur: 0.3, gain: 0.05, delay: 0.1, from: 2000, to: 8000 })
  },
  wrong() {
    tone(196, { type: 'sawtooth', dur: 0.35, gain: 0.16, slideTo: 98 })
    tone(98, { type: 'square', dur: 0.4, gain: 0.08, delay: 0.06, slideTo: 65 })
  },
  tick() {
    tone(1250, { type: 'square', dur: 0.035, gain: 0.05 })
  },
  hover() {
    tone(2400, { type: 'sine', dur: 0.03, gain: 0.02 })
  },
  whoosh() {
    noise({ dur: 0.35, gain: 0.07, from: 300, to: 4500 })
  },
  gameover() {
    tone(392, { dur: 0.3, gain: 0.14 })
    tone(311.1, { dur: 0.32, gain: 0.14, delay: 0.18 })
    tone(233.1, { dur: 0.6, gain: 0.16, delay: 0.36 })
  },
}
