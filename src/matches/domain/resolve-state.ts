import type { Match, MatchStatus } from './match'

// Mirrors `LIVE_WINDOW_MS` in `src/featured/domain/select-featured-state.ts`.
// Duplicated here intentionally to keep the matches-domain module free of any
// dependency on the featured-domain module (dependency rule: featured depends
// on matches, never the reverse).
const LIVE_WINDOW_MS = 110 * 60_000

export function resolveState(match: Match, now: number): MatchStatus {
  // Data wins: explicit non-scheduled statuses are authoritative regardless of
  // clock (matches.md §5 AC-10).
  if (match.status !== 'scheduled') return match.status

  const kickoffMs = Date.parse(match.utcKickoff)
  if (now < kickoffMs) return 'scheduled'
  if (now < kickoffMs + LIVE_WINDOW_MS) return 'live'
  return 'finished'
}
