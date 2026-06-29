import type { Match } from '@/matches/domain/match'
import { hasUndeterminedTeam } from '@/matches/domain/match'
import { byKickoffThenId } from '@/matches/domain/sort'
import { isSameLocalDay } from '@/matches/domain/today'
import type { FeaturedState } from './featured-state'

export const LIVE_WINDOW_MS = 110 * 60_000

export { byKickoffThenId }

// State precedence (specs/matches.md §5 + specs/featured.md §3):
//  - `cancelled` / `postponed` → excluded from every candidate set.
//  - `finished`                → excluded from live + upcoming sets.
//  - `live`                    → forced live regardless of clock (data wins).
//  - `scheduled`               → derive from clock against the 110-min window.
export function isLive(match: Match, now: number): boolean {
  // A bracket slot with an undetermined team is never a featured candidate:
  // there is no real derby to headline (featured.md §3). It still counts for
  // tournament-end detection below, so it is NOT filtered there.
  if (hasUndeterminedTeam(match)) return false
  if (match.status === 'cancelled' || match.status === 'postponed') return false
  if (match.status === 'finished') return false
  if (match.status === 'live') return true

  const kickoffMs = Date.parse(match.utcKickoff)
  return now >= kickoffMs && now < kickoffMs + LIVE_WINDOW_MS
}

export function isUpcoming(match: Match, now: number): boolean {
  if (hasUndeterminedTeam(match)) return false
  if (match.status !== 'scheduled') return false
  return now < Date.parse(match.utcKickoff)
}

export function computeTournamentEnd(matches: readonly Match[]): number | null {
  let maxKickoff = -Infinity
  for (const m of matches) {
    if (m.status === 'cancelled' || m.status === 'postponed') continue
    const k = Date.parse(m.utcKickoff)
    if (k > maxKickoff) maxKickoff = k
  }
  if (maxKickoff === -Infinity) return null
  return maxKickoff + LIVE_WINDOW_MS
}

export function selectFeaturedState(matches: readonly Match[], now: number): FeaturedState {
  const live = matches.filter((m) => isLive(m, now))
  if (live.length === 1) {
    const [only] = live
    if (only !== undefined) return { kind: 'live-single', match: only }
  }
  if (live.length >= 2) {
    return {
      kind: 'live-multiple',
      count: live.length,
      matches: [...live].sort(byKickoffThenId),
    }
  }

  const upcomingToday = matches
    .filter((m) => isUpcoming(m, now) && isSameLocalDay(m.utcKickoff, now))
    .slice()
    .sort(byKickoffThenId)
  const nextToday = upcomingToday[0]
  if (nextToday !== undefined) {
    return {
      kind: 'upcoming-today',
      match: nextToday,
      msUntilKickoff: Date.parse(nextToday.utcKickoff) - now,
    }
  }

  const upcomingFuture = matches
    .filter((m) => isUpcoming(m, now))
    .slice()
    .sort(byKickoffThenId)
  const nextFuture = upcomingFuture[0]
  if (nextFuture !== undefined) {
    return {
      kind: 'upcoming-future',
      match: nextFuture,
      msUntilKickoff: Date.parse(nextFuture.utcKickoff) - now,
    }
  }

  // `tournament-over` is governed by the real tournament end (last playable
  // kickoff + live window), NOT by the absence of matches with determined
  // teams. During the knockout stage the bracket fills round by round, so
  // future rounds legitimately exist as `xx` placeholders. While the
  // tournament has not ended, surface the next scheduled match even if its
  // teams are still undetermined (featured.md §2, §5).
  const tournamentEnd = computeTournamentEnd(matches)
  if (tournamentEnd !== null && now < tournamentEnd) {
    const nextPending = matches
      .filter((m) => m.status === 'scheduled' && now < Date.parse(m.utcKickoff))
      .slice()
      .sort(byKickoffThenId)[0]
    if (nextPending !== undefined) {
      return {
        kind: isSameLocalDay(nextPending.utcKickoff, now) ? 'upcoming-today' : 'upcoming-future',
        match: nextPending,
        msUntilKickoff: Date.parse(nextPending.utcKickoff) - now,
      }
    }
  }

  return { kind: 'tournament-over' }
}
