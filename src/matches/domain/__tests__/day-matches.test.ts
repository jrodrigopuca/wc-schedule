import { describe, expect, it } from 'vitest'
import type { Match } from '@/matches/domain/match'
import { dayMatchCount, matchesForDay } from '@/matches/domain/day-matches'

// BA-pinned host TZ. 2026-06-13 local day spans 2026-06-13T03:00Z..2026-06-14T03:00Z.

const NOW = Date.parse('2026-06-13T17:00:00Z')

const MATCH_TODAY_LATE: Match = {
  id: 'm-today-late',
  utcKickoff: '2026-06-13T22:00:00Z', // 19:00 BA on 2026-06-13
  status: 'scheduled',
  stage: 'group',
  teamA: { iso: 'ar', name: 'Argentina' },
  teamB: { iso: 'br', name: 'Brasil' },
}

const MATCH_TODAY_EARLY: Match = {
  id: 'm-today-early',
  utcKickoff: '2026-06-13T18:00:00Z', // 15:00 BA on 2026-06-13
  status: 'scheduled',
  stage: 'group',
  teamA: { iso: 'mx', name: 'México' },
  teamB: { iso: 'fr', name: 'Francia' },
}

const MATCH_TODAY_CANCELLED: Match = {
  id: 'm-today-cancelled',
  utcKickoff: '2026-06-13T19:00:00Z',
  status: 'cancelled',
  stage: 'group',
  teamA: { iso: 'de', name: 'Alemania' },
  teamB: { iso: 'es', name: 'España' },
}

const MATCH_TIE_A: Match = {
  id: 'm-tie-a',
  utcKickoff: '2026-06-13T22:00:00Z',
  status: 'scheduled',
  stage: 'group',
  teamA: { iso: 'jp', name: 'Japón' },
  teamB: { iso: 'kr', name: 'Corea' },
}

const MATCH_TOMORROW: Match = {
  id: 'm-tomorrow',
  utcKickoff: '2026-06-14T18:00:00Z',
  status: 'scheduled',
  stage: 'group',
  teamA: { iso: 'it', name: 'Italia' },
  teamB: { iso: 'pt', name: 'Portugal' },
}

describe('matchesForDay', () => {
  it('returns only matches for the requested local day', () => {
    const result = matchesForDay(
      [MATCH_TOMORROW, MATCH_TODAY_LATE, MATCH_TODAY_EARLY],
      '2026-06-13',
      NOW,
    )
    expect(result.map((m) => m.id)).toEqual(['m-today-early', 'm-today-late'])
  })

  it('excludes cancelled matches (matches.md AC-6)', () => {
    const result = matchesForDay(
      [MATCH_TODAY_EARLY, MATCH_TODAY_CANCELLED, MATCH_TODAY_LATE],
      '2026-06-13',
      NOW,
    )
    expect(result.map((m) => m.id)).toEqual(['m-today-early', 'm-today-late'])
  })

  it('sort order matches byKickoffThenId (id-asc tiebreaker)', () => {
    // MATCH_TIE_A and MATCH_TODAY_LATE share the same kickoff (22:00Z).
    // ids: 'm-tie-a' < 'm-today-late' lexicographically.
    const result = matchesForDay(
      [MATCH_TODAY_LATE, MATCH_TODAY_EARLY, MATCH_TIE_A],
      '2026-06-13',
      NOW,
    )
    expect(result.map((m) => m.id)).toEqual(['m-today-early', 'm-tie-a', 'm-today-late'])
  })

  it('returns empty for a day with no matches', () => {
    const result = matchesForDay([MATCH_TODAY_LATE], '2026-06-15', NOW)
    expect(result).toEqual([])
  })
})

describe('dayMatchCount', () => {
  it('returns the post-filter count', () => {
    const n = dayMatchCount(
      [MATCH_TODAY_EARLY, MATCH_TODAY_CANCELLED, MATCH_TODAY_LATE, MATCH_TOMORROW],
      '2026-06-13',
      NOW,
    )
    expect(n).toBe(2)
  })

  it('returns zero for an empty day', () => {
    expect(dayMatchCount([MATCH_TODAY_EARLY], '2026-07-01', NOW)).toBe(0)
  })
})
