import { useEffect, useState } from 'react'

/**
 * Seconds elapsed since `active` became true, reset to 0 when it goes false.
 * AI generation can legitimately take up to ~110s (see ai-fallback.ts) --
 * a bare spinner with no time signal reads as "stuck" well before that.
 * This gives the user something to judge against instead of guessing
 * whether to wait it out or bail.
 */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!active) return
    setSeconds(0)
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [active])

  return seconds
}
