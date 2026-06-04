// Local-day arithmetic for "today" detection.
//
// We compute the local-midnight epoch via `new Date(y, m, d)` (host zone) and
// then step forward by exactly 24h in epoch ms. On DST transition days the
// "real" local day is 23h or 25h, so the +24h step technically overlaps the
// adjacent day by ±1h. Accepted for MVP per design §11/§12.1 — no World Cup
// kickoff lands in that 1h boundary in practice.
const DAY_MS = 86_400_000

export interface DayBounds {
  readonly startMs: number
  readonly endMs: number
}

export function todayBounds(now: number): DayBounds {
  const d = new Date(now)
  const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return { startMs, endMs: startMs + DAY_MS }
}

export function isToday(utcKickoff: string, now: number): boolean {
  const { startMs, endMs } = todayBounds(now)
  const kickoffMs = Date.parse(utcKickoff)
  return kickoffMs >= startMs && kickoffMs < endMs
}

// Alias of `isToday`: lets call sites in the featured selector read naturally
// (`isSameLocalDay(match.utcKickoff, now)`) while list/UI code uses `isToday`.
export function isSameLocalDay(utcKickoff: string, now: number): boolean {
  return isToday(utcKickoff, now)
}
