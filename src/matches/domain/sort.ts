import type { Match } from './match'

// Sort by kickoff instant ascending, tie-break by id ascending. ISO 8601
// strings with a trailing `Z` sort lexicographically the same as their
// underlying instant, so we avoid the extra `Date.parse` per comparison.
export function byKickoffThenId(a: Match, b: Match): number {
  if (a.utcKickoff < b.utcKickoff) return -1
  if (a.utcKickoff > b.utcKickoff) return 1
  return a.id.localeCompare(b.id)
}
