// Pure refresh-window logic (design.md §10.1, data-source.md §6).
//
// Two pure functions drive the whole cron:
//   - `getRefreshMode(now)` decides WHICH window the current instant sits in.
//   - `shouldFetch(mode, today, lastRefresh)` decides whether THIS run should
//     actually call upstream, given the cadence budget for the mode.
//
// Both are pure and UTC-date-only so they are trivially testable and immune
// to the runner's timezone. No I/O, no clock reads beyond the injected `now`.

import {
  TOURNAMENT_START_UTC,
  TOURNAMENT_END_UTC,
  NEAR_LEAD_DAYS,
  NEAR_TAIL_DAYS,
  type RefreshMode,
} from './tournament.ts'

const DAY_MS = 24 * 60 * 60 * 1000

// Collapse an ISO date (YYYY-MM-DD) to its UTC-midnight epoch. We parse the
// parts by hand rather than `new Date(isoDate)` so there is zero chance of a
// local-timezone interpretation creeping in.
export function utcMidnight(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

// UTC calendar date for an arbitrary instant, as a midnight-aligned epoch.
export function utcDateOf(now: number): number {
  return utcMidnight(new Date(now).toISOString().slice(0, 10))
}

export function getRefreshMode(now: number): RefreshMode {
  const today = utcDateOf(now)
  const start = utcMidnight(TOURNAMENT_START_UTC)
  const end = utcMidnight(TOURNAMENT_END_UTC)

  // Inclusive on both ends: the kickoff day and the final day are both
  // "tournament" (24h cadence).
  if (today >= start && today <= end) return 'tournament'

  const nearStart = start - NEAR_LEAD_DAYS * DAY_MS
  const nearEnd = end + NEAR_TAIL_DAYS * DAY_MS
  if (today >= nearStart && today <= nearEnd) return 'near'

  return 'off'
}

// Given the mode, today's UTC date, and the UTC date of the last successful
// refresh, decide whether this run should fetch upstream.
//
// - "off"  → never fetch (the cron is a complete no-op outside both windows).
// - "tournament" → fetch on EVERY cron run (~4h). Results and bracket slots
//   resolve fast upstream, so during the tournament we want them live within
//   one cron tick, not up to 24h later. The no-change short-circuit in
//   `rotate.ts` makes an unchanged re-fetch a no-op (no rotation, no commit),
//   so polling every 4h costs 6 cheap upstream calls/day and zero junk commits.
// - first-ever run (no previous refresh) → always fetch.
// - "near"       → fetch when ≥ 2 UTC days have elapsed (48h cadence).
export function shouldFetch(
  mode: RefreshMode,
  todayUtcMs: number,
  lastRefreshUtcMs: number | null,
): boolean {
  if (mode === 'off') return false
  if (mode === 'tournament') return true
  if (lastRefreshUtcMs === null) return true
  const diffDays = Math.round((todayUtcMs - lastRefreshUtcMs) / DAY_MS)
  return diffDays >= 2
}
