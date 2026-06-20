import { describe, expect, it } from 'vitest'
import type { Match, MatchStatus } from '@/matches/domain/match'
import { NOTIFICATION_LEAD_MS } from '@/notifications/domain/lead-time'
import { planSchedule } from '@/notifications/domain/schedule'

// 2026-06-13T17:00:00Z, the canonical "during the tournament" instant we
// use across the codebase. Kept as a literal here so the test reads
// without an extra `Date.parse` indirection.
const NOW = Date.parse('2026-06-13T17:00:00Z')

function makeMatch(overrides: Partial<Match> & { utcKickoff: string }): Match {
  // Build deterministic match fixtures. `id` defaults to the kickoff
  // string so the assertions can refer back to inputs by hand.
  return {
    id: overrides.id ?? `m-${overrides.utcKickoff}`,
    utcKickoff: overrides.utcKickoff,
    status: overrides.status ?? 'scheduled',
    stage: overrides.stage ?? 'group',
    teamA: overrides.teamA ?? { iso: 'ar', name: 'Argentina' },
    teamB: overrides.teamB ?? { iso: 'br', name: 'Brasil' },
    ...(overrides.group !== undefined ? { group: overrides.group } : {}),
    ...(overrides.score !== undefined ? { score: overrides.score } : {}),
    ...(overrides.venue !== undefined ? { venue: overrides.venue } : {}),
  }
}

describe('planSchedule — eligibility filtering', () => {
  it('keeps only `scheduled` matches; drops live/finished/postponed/cancelled', () => {
    const future = new Date(NOW + 4 * 60 * 60 * 1000).toISOString()
    const statuses: readonly MatchStatus[] = [
      'scheduled',
      'live',
      'finished',
      'postponed',
      'cancelled',
    ]
    const matches = statuses.map((status, i) =>
      makeMatch({ id: `m-${i}-${status}`, utcKickoff: future, status }),
    )
    const out = planSchedule(matches, NOW)
    expect(out.map((e) => e.matchId)).toEqual(['m-0-scheduled'])
  })

  it('skips matches with an undetermined team (iso xx)', () => {
    const future = new Date(NOW + 4 * 60 * 60 * 1000).toISOString()
    const matches = [
      makeMatch({ id: 'real', utcKickoff: future }),
      makeMatch({
        id: 'tbd',
        utcKickoff: future,
        stage: 'round-of-32',
        teamA: { iso: 'xx', name: '1º A' },
        teamB: { iso: 'xx', name: '2º B' },
      }),
    ]
    const out = planSchedule(matches, NOW)
    expect(out.map((e) => e.matchId)).toEqual(['real'])
  })

  it('excludes entries whose fireAtMs is already in the past', () => {
    // Kickoff is 5 min in the future → fireAt = kickoff - 15min = -10min
    // (past). MUST be filtered (AC-5 "no retroactive notification").
    const inFiveMin = new Date(NOW + 5 * 60 * 1000).toISOString()
    const out = planSchedule([makeMatch({ utcKickoff: inFiveMin })], NOW)
    expect(out).toHaveLength(0)
  })

  it('excludes entries where fireAtMs === now (boundary)', () => {
    // Kickoff exactly 15 min away → fireAt === now. The planner uses
    // strict `<=` to exclude this case (arming a 0ms timer is racy).
    const exactlyLeadAway = new Date(NOW + NOTIFICATION_LEAD_MS).toISOString()
    const out = planSchedule([makeMatch({ utcKickoff: exactlyLeadAway })], NOW)
    expect(out).toHaveLength(0)
  })

  it('includes entries where fireAtMs === now + 1 (just past the boundary)', () => {
    const justInside = new Date(NOW + NOTIFICATION_LEAD_MS + 1).toISOString()
    const out = planSchedule([makeMatch({ utcKickoff: justInside })], NOW)
    expect(out).toHaveLength(1)
    expect(out[0]?.fireAtMs).toBe(NOW + 1)
  })
})

describe('planSchedule — output shape', () => {
  it('maps `match.id` → `matchId`', () => {
    const kick = new Date(NOW + 2 * 60 * 60 * 1000).toISOString()
    const out = planSchedule([makeMatch({ id: 'arg-bra-001', utcKickoff: kick })], NOW)
    expect(out[0]?.matchId).toBe('arg-bra-001')
  })

  it('carries the projected match data (no score, no venue leakage)', () => {
    const kick = new Date(NOW + 2 * 60 * 60 * 1000).toISOString()
    const out = planSchedule(
      [
        makeMatch({
          utcKickoff: kick,
          group: 'A',
          score: { home: 1, away: 2 },
          venue: { city: 'CDMX', country: 'MX' },
        }),
      ],
      NOW,
    )
    const entry = out[0]
    expect(entry).toBeDefined()
    // ScheduleEntryMatchData explicitly excludes score/venue; the spread
    // pattern in the planner enforces this at compile AND runtime.
    expect(Object.keys(entry!.match)).toEqual(
      expect.arrayContaining(['id', 'utcKickoff', 'stage', 'teamA', 'teamB', 'group']),
    )
    expect(entry!.match).not.toHaveProperty('score')
    expect(entry!.match).not.toHaveProperty('venue')
  })

  it('omits `group` when the source match has none', () => {
    const kick = new Date(NOW + 2 * 60 * 60 * 1000).toISOString()
    const out = planSchedule([makeMatch({ utcKickoff: kick })], NOW)
    expect(out[0]?.match).not.toHaveProperty('group')
  })
})

describe('planSchedule — ordering & determinism', () => {
  it('sorts entries ascending by fireAtMs', () => {
    const k1 = new Date(NOW + 4 * 60 * 60 * 1000).toISOString()
    const k2 = new Date(NOW + 2 * 60 * 60 * 1000).toISOString()
    const k3 = new Date(NOW + 6 * 60 * 60 * 1000).toISOString()
    const out = planSchedule(
      [
        makeMatch({ id: 'late', utcKickoff: k1 }),
        makeMatch({ id: 'early', utcKickoff: k2 }),
        makeMatch({ id: 'latest', utcKickoff: k3 }),
      ],
      NOW,
    )
    expect(out.map((e) => e.matchId)).toEqual(['early', 'late', 'latest'])
  })

  it('is idempotent — same inputs yield equal outputs', () => {
    const k1 = new Date(NOW + 4 * 60 * 60 * 1000).toISOString()
    const k2 = new Date(NOW + 2 * 60 * 60 * 1000).toISOString()
    const matches = [makeMatch({ id: 'a', utcKickoff: k1 }), makeMatch({ id: 'b', utcKickoff: k2 })]
    const first = planSchedule(matches, NOW)
    const second = planSchedule(matches, NOW)
    expect(second).toEqual(first)
  })
})
