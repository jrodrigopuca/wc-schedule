// Day-filter pure functions. Sibling of `today.ts`, but parameterized
// by an arbitrary YYYY-MM-DD instead of the host's "today".

import type { Match } from './match'
import { byKickoffThenId } from './sort'
import { dayBoundsForYMD } from './tournament-day'

// `now` is accepted for symmetry with other time-aware helpers
// (and to leave room for a future calendar-aware override). The local
// zone is read from the host clock so the parameter is purely
// declarative today.
export function matchesForDay(
  matches: readonly Match[],
  dayYMD: string,
  _now: number,
): readonly Match[] {
  void _now
  const { utcStartMs, utcEndMs } = dayBoundsForYMD(dayYMD)
  const filtered = matches.filter((m) => {
    if (m.status === 'cancelled') return false
    const kickoffMs = Date.parse(m.utcKickoff)
    return kickoffMs >= utcStartMs && kickoffMs < utcEndMs
  })
  return [...filtered].sort(byKickoffThenId)
}

export function dayMatchCount(matches: readonly Match[], dayYMD: string, now: number): number {
  return matchesForDay(matches, dayYMD, now).length
}
