import { useEffect, useRef } from 'react'
import { sfx } from '../audio/sfx'

interface Props {
  startedAt: number
  durationMs: number
  running: boolean
  onExpire: () => void
}

/**
 * Conic-gradient countdown ring around the current actor. Drives itself with
 * rAF (no React re-renders per frame); ticks audibly for the last 3 seconds.
 */
export function TimerRing({ startedAt, durationMs, running, onExpire }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const expired = useRef(false)
  const lastWholeSec = useRef(-1)

  useEffect(() => {
    expired.current = false
    lastWholeSec.current = -1
    let raf = 0
    const frame = () => {
      const node = el.current
      if (!node) return
      const remaining = Math.max(0, durationMs - (performance.now() - startedAt))
      const frac = remaining / durationMs
      const urgent = remaining < 3200
      node.style.setProperty('--frac', String(frac))
      node.classList.toggle('urgent', urgent && running)

      if (running) {
        const sec = Math.ceil(remaining / 1000)
        if (urgent && sec !== lastWholeSec.current && remaining > 0) {
          lastWholeSec.current = sec
          sfx.tick()
        }
        if (remaining <= 0 && !expired.current) {
          expired.current = true
          onExpire()
          return
        }
      }
      raf = requestAnimationFrame(frame)
    }
    // When not running the ring freezes where it was (reveal/miss states)
    if (running) raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, durationMs, running, onExpire])

  return <div ref={el} className="timer-ring" aria-hidden />
}
