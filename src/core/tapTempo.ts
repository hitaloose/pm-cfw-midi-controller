import { MAX_BPM, MIN_BPM, TAP_HISTORY, TAP_TIMEOUT_MS } from './config'

/** Adds a tap to the history, restarting it if the last tap is too old. */
export function addTap(tapTimes: readonly number[], nowMs: number): number[] {
  const last = tapTimes[tapTimes.length - 1]
  if (last === undefined || nowMs - last > TAP_TIMEOUT_MS) return [nowMs]
  const next = [...tapTimes, nowMs]
  return next.length > TAP_HISTORY ? next.slice(next.length - TAP_HISTORY) : next
}

/** BPM from the average tap interval, or null with fewer than 2 taps. */
export function bpmFromTaps(tapTimes: readonly number[]): number | null {
  if (tapTimes.length < 2) return null
  const avgInterval = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1)
  const bpm = Math.round(60000 / avgInterval)
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))
}

/** Beat length in ms for a BPM (integer, as the firmware will use). */
export function beatPeriodMs(bpm: number): number {
  return Math.round(60000 / bpm)
}
