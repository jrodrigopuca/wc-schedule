import { afterEach, describe, expect, it } from 'vitest'
import { __resetClockForTests, __setClockForTests, getNow } from '@/shared/time/now'
import type { Match } from '@/matches/domain/match'
import { matchListSchema } from '@/matches/domain/match.schema'
import fixtureJson from '@/shared/fixture/matches.fixture.json'
import {
  LIVE_WINDOW_MS,
  computeTournamentEnd,
  isLive,
  isUpcoming,
  selectFeaturedState,
} from '@/featured/domain/select-featured-state'

const fixture: readonly Match[] = matchListSchema.parse(fixtureJson)

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'wc2026-001',
    utcKickoff: '2026-06-12T20:00:00Z',
    status: 'scheduled',
    stage: 'group',
    teamA: { iso: 'ar', name: 'Argentina' },
    teamB: { iso: 'br', name: 'Brasil' },
    ...overrides,
  }
}

afterEach(() => {
  __resetClockForTests()
})

describe('LIVE_WINDOW_MS', () => {
  it('is 110 minutes in ms', () => {
    expect(LIVE_WINDOW_MS).toBe(110 * 60_000)
  })
})

describe('undetermined bracket slots (iso xx) are excluded from featured', () => {
  const kickoff = '2026-06-12T20:00:00Z'
  const tbd = makeMatch({
    stage: 'round-of-32',
    teamA: { iso: 'xx', name: '1º grupo A' },
    teamB: { iso: 'xx', name: '2º grupo B' },
  })

  it('isUpcoming is false even before kickoff', () => {
    expect(isUpcoming(tbd, Date.parse(kickoff) - 60_000)).toBe(false)
  })

  it('isLive is false even inside the live window', () => {
    expect(isLive(tbd, Date.parse(kickoff) + 1)).toBe(false)
  })

  it('selectFeaturedState skips an earlier undetermined match for the next real one', () => {
    const now = Date.parse('2026-06-12T10:00:00Z')
    const real = makeMatch({ id: 'real', utcKickoff: '2026-06-12T20:00:00Z' })
    const tbdSooner = makeMatch({
      id: 'tbd',
      utcKickoff: '2026-06-12T18:00:00Z',
      teamA: { iso: 'xx', name: '1º A' },
      teamB: { iso: 'xx', name: '2º B' },
    })
    const state = selectFeaturedState([tbdSooner, real], now)
    expect(state.kind).toBe('upcoming-today')
    if (state.kind === 'upcoming-today') expect(state.match.id).toBe('real')
  })
})

describe('isLive', () => {
  const kickoff = '2026-06-12T20:00:00Z'
  const kickoffMs = Date.parse(kickoff)

  it('is true at the exact kickoff instant', () => {
    expect(isLive(makeMatch({ utcKickoff: kickoff }), kickoffMs)).toBe(true)
  })

  it('is true one ms after kickoff', () => {
    expect(isLive(makeMatch({ utcKickoff: kickoff }), kickoffMs + 1)).toBe(true)
  })

  it('is false just before kickoff', () => {
    expect(isLive(makeMatch({ utcKickoff: kickoff }), kickoffMs - 1)).toBe(false)
  })

  it('is false at the end of the live window (exclusive)', () => {
    expect(isLive(makeMatch({ utcKickoff: kickoff }), kickoffMs + LIVE_WINDOW_MS)).toBe(false)
  })

  it('is true at LIVE_WINDOW_MS - 1', () => {
    expect(isLive(makeMatch({ utcKickoff: kickoff }), kickoffMs + LIVE_WINDOW_MS - 1)).toBe(true)
  })

  it('is false past the live window', () => {
    expect(isLive(makeMatch({ utcKickoff: kickoff }), kickoffMs + LIVE_WINDOW_MS + 1)).toBe(false)
  })

  it('data wins: status=live forces true even when clock is far before kickoff', () => {
    const m = makeMatch({ utcKickoff: kickoff, status: 'live' })
    expect(isLive(m, kickoffMs - 3 * 60 * 60_000)).toBe(true)
  })

  it('status=finished forces false even inside the window', () => {
    const m = makeMatch({ utcKickoff: kickoff, status: 'finished' })
    expect(isLive(m, kickoffMs + 30 * 60_000)).toBe(false)
  })

  it('status=cancelled forces false even inside the window', () => {
    const m = makeMatch({ utcKickoff: kickoff, status: 'cancelled' })
    expect(isLive(m, kickoffMs + 30 * 60_000)).toBe(false)
  })

  it('status=postponed forces false even inside the window', () => {
    const m = makeMatch({ utcKickoff: kickoff, status: 'postponed' })
    expect(isLive(m, kickoffMs + 30 * 60_000)).toBe(false)
  })
})

describe('isUpcoming', () => {
  const kickoff = '2026-06-12T20:00:00Z'
  const kickoffMs = Date.parse(kickoff)

  it('is true when now is before kickoff and status is scheduled', () => {
    expect(isUpcoming(makeMatch({ utcKickoff: kickoff }), kickoffMs - 1)).toBe(true)
  })

  it('is false at the kickoff instant (boundary inclusive on live, not upcoming)', () => {
    expect(isUpcoming(makeMatch({ utcKickoff: kickoff }), kickoffMs)).toBe(false)
  })

  it('is false for non-scheduled statuses', () => {
    for (const status of ['live', 'finished', 'cancelled', 'postponed'] as const) {
      expect(isUpcoming(makeMatch({ utcKickoff: kickoff, status }), kickoffMs - 60_000)).toBe(false)
    }
  })
})

describe('computeTournamentEnd', () => {
  it('returns null for an empty list', () => {
    expect(computeTournamentEnd([])).toBe(null)
  })

  it('returns null when every match is cancelled/postponed', () => {
    expect(
      computeTournamentEnd([
        makeMatch({ id: 'a', status: 'cancelled' }),
        makeMatch({ id: 'b', status: 'postponed' }),
      ]),
    ).toBe(null)
  })

  it('returns max(utcKickoff) + LIVE_WINDOW_MS', () => {
    const matches = [
      makeMatch({ id: 'a', utcKickoff: '2026-06-12T20:00:00Z' }),
      makeMatch({ id: 'b', utcKickoff: '2026-07-19T19:00:00Z' }),
      makeMatch({ id: 'c', utcKickoff: '2026-06-14T22:00:00Z' }),
    ]
    expect(computeTournamentEnd(matches)).toBe(Date.parse('2026-07-19T19:00:00Z') + LIVE_WINDOW_MS)
  })

  it('uses the fixture max kickoff', () => {
    // Final is on 2026-07-19T19:00:00Z in the fixture (latest kickoff).
    expect(computeTournamentEnd(fixture)).toBe(Date.parse('2026-07-19T19:00:00Z') + LIVE_WINDOW_MS)
  })
})

describe('selectFeaturedState — AC-1: live-single', () => {
  it('returns live-single when exactly one match is in its window', () => {
    const live = makeMatch({
      id: 'live-1',
      utcKickoff: '2026-06-12T19:00:00Z',
    })
    const future = makeMatch({
      id: 'fut-1',
      utcKickoff: '2026-06-13T19:00:00Z',
    })
    // 20 minutes after kickoff: well inside the window.
    const now = Date.parse('2026-06-12T19:20:00Z')
    __setClockForTests(() => now)

    const state = selectFeaturedState([live, future], getNow())
    expect(state.kind).toBe('live-single')
    if (state.kind === 'live-single') {
      expect(state.match.id).toBe('live-1')
    }
  })
})

describe('selectFeaturedState — AC-2: live-multiple', () => {
  it('returns live-multiple with count=2 when two matches are simultaneously live', () => {
    const liveA = makeMatch({
      id: 'live-a',
      utcKickoff: '2026-06-12T19:00:00Z',
    })
    const liveB = makeMatch({
      id: 'live-b',
      utcKickoff: '2026-06-12T19:00:00Z',
      teamA: { iso: 'fr', name: 'Francia' },
      teamB: { iso: 'es', name: 'España' },
    })
    const now = Date.parse('2026-06-12T19:20:00Z')

    const state = selectFeaturedState([liveA, liveB], now)
    expect(state.kind).toBe('live-multiple')
    if (state.kind === 'live-multiple') {
      expect(state.count).toBe(2)
      expect(state.matches.map((m) => m.id)).toEqual(['live-a', 'live-b'])
    }
  })
})

describe('selectFeaturedState — AC-3 / AC-4: upcoming-today', () => {
  it('AC-3: picks the earliest-kickoff upcoming-today match', () => {
    // Now = 2026-06-12T17:00:00Z → 14:00 BA → local day is 2026-06-12.
    const now = Date.parse('2026-06-12T17:00:00Z')
    const t1 = makeMatch({ id: 't1', utcKickoff: '2026-06-12T19:00:00Z' })
    const t2 = makeMatch({ id: 't2', utcKickoff: '2026-06-12T22:00:00Z' })
    const t3 = makeMatch({ id: 't3', utcKickoff: '2026-06-13T01:00:00Z' }) // 22:00 BA same local day

    const state = selectFeaturedState([t2, t3, t1], now)
    expect(state.kind).toBe('upcoming-today')
    if (state.kind === 'upcoming-today') {
      expect(state.match.id).toBe('t1')
      expect(state.msUntilKickoff).toBe(Date.parse('2026-06-12T19:00:00Z') - now)
    }
  })

  it('AC-4: tiebreaker by id when two matches share the kickoff instant', () => {
    const now = Date.parse('2026-06-12T17:00:00Z')
    const zzz = makeMatch({ id: 'wc-zzz', utcKickoff: '2026-06-12T19:00:00Z' })
    const aaa = makeMatch({ id: 'wc-aaa', utcKickoff: '2026-06-12T19:00:00Z' })

    const state = selectFeaturedState([zzz, aaa], now)
    expect(state.kind).toBe('upcoming-today')
    if (state.kind === 'upcoming-today') {
      expect(state.match.id).toBe('wc-aaa')
    }
  })
})

describe('selectFeaturedState — AC-5: upcoming-future', () => {
  it('returns upcoming-future when no live and no today match exists', () => {
    // Now is 2026-06-12T17:00:00Z → today (BA) is 2026-06-12.
    const now = Date.parse('2026-06-12T17:00:00Z')
    // All matches are scheduled for tomorrow or later.
    const tomorrow = makeMatch({ id: 'tom', utcKickoff: '2026-06-13T19:00:00Z' })
    const farther = makeMatch({ id: 'far', utcKickoff: '2026-06-14T19:00:00Z' })

    const state = selectFeaturedState([farther, tomorrow], now)
    expect(state.kind).toBe('upcoming-future')
    if (state.kind === 'upcoming-future') {
      expect(state.match.id).toBe('tom')
      expect(state.msUntilKickoff).toBe(Date.parse('2026-06-13T19:00:00Z') - now)
    }
  })
})

describe('selectFeaturedState — AC-6: tournament-over', () => {
  it('returns tournament-over for an empty list', () => {
    expect(selectFeaturedState([], Date.parse('2026-08-01T00:00:00Z'))).toEqual({
      kind: 'tournament-over',
    })
  })

  it('returns tournament-over when all matches are finished and tournamentEnd has passed', () => {
    const past = makeMatch({
      id: 'past-1',
      utcKickoff: '2026-06-12T19:00:00Z',
      status: 'finished',
    })
    const now = Date.parse('2026-08-01T00:00:00Z') // long after the window
    const state = selectFeaturedState([past], now)
    expect(state.kind).toBe('tournament-over')
  })

  it('does NOT report tournament-over during the knockout gap (next round is undetermined)', () => {
    // Regression: once every group-stage match with determined teams has been
    // played, the only future matches are undetermined bracket slots (iso xx).
    // The tournament has NOT ended, so we must surface the next pending round
    // instead of falsely declaring the cup over.
    const playedGroup = makeMatch({
      id: 'group-last',
      utcKickoff: '2026-06-27T19:00:00Z',
      status: 'finished',
    })
    const knockout = makeMatch({
      id: 'r32-1',
      stage: 'round-of-32',
      utcKickoff: '2026-07-05T16:00:00Z',
      teamA: { iso: 'xx', name: '1º grupo A' },
      teamB: { iso: 'xx', name: '2º grupo B' },
    })
    const final = makeMatch({
      id: 'final',
      stage: 'final',
      utcKickoff: '2026-07-19T19:00:00Z',
      teamA: { iso: 'xx', name: 'Por definir' },
      teamB: { iso: 'xx', name: 'Por definir' },
    })
    // After the last group match, before the first knockout kickoff.
    const now = Date.parse('2026-06-28T12:00:00Z')
    const state = selectFeaturedState([playedGroup, knockout, final], now)
    expect(state.kind).toBe('upcoming-future')
    if (state.kind === 'upcoming-future') {
      expect(state.match.id).toBe('r32-1')
      expect(state.msUntilKickoff).toBe(Date.parse('2026-07-05T16:00:00Z') - now)
    }
  })

  it('reports upcoming-today when the next undetermined match kicks off today', () => {
    // Same knockout gap, but the next pending bracket slot is TODAY: it must
    // read as upcoming-today (time only), not upcoming-future (with a date),
    // matching how the rest of the selector treats same-local-day fixtures.
    const playedGroup = makeMatch({
      id: 'group-last',
      utcKickoff: '2026-07-04T19:00:00Z',
      status: 'finished',
    })
    const knockoutToday = makeMatch({
      id: 'r32-today',
      stage: 'round-of-32',
      utcKickoff: '2026-07-05T19:00:00Z',
      teamA: { iso: 'xx', name: '1º grupo A' },
      teamB: { iso: 'xx', name: '2º grupo B' },
    })
    // Now = 2026-07-05T16:00:00Z → 13:00 BA → same local day as the kickoff.
    const now = Date.parse('2026-07-05T16:00:00Z')
    const state = selectFeaturedState([playedGroup, knockoutToday], now)
    expect(state.kind).toBe('upcoming-today')
    if (state.kind === 'upcoming-today') {
      expect(state.match.id).toBe('r32-today')
    }
  })
})

describe('selectFeaturedState — AC-7: kickoff transition (boundary inclusive)', () => {
  it('flips from upcoming to live exactly at the kickoff instant', () => {
    const match = makeMatch({ id: 'flip', utcKickoff: '2026-06-12T19:00:00Z' })
    const kickoffMs = Date.parse(match.utcKickoff)

    // 1 ms before kickoff → still upcoming.
    const before = selectFeaturedState([match], kickoffMs - 1)
    expect(before.kind).toBe('upcoming-today')

    // Exact kickoff → live (boundary inclusive on `now >= kickoff`).
    const at = selectFeaturedState([match], kickoffMs)
    expect(at.kind).toBe('live-single')
  })
})

describe('selectFeaturedState — AC-10: drift after background', () => {
  it('jumping now past a kickoff updates the result deterministically', () => {
    const match = makeMatch({ id: 'a', utcKickoff: '2026-06-12T19:00:00Z' })
    const before = selectFeaturedState([match], Date.parse('2026-06-12T18:50:00Z'))
    const after = selectFeaturedState([match], Date.parse('2026-06-12T19:10:00Z'))

    expect(before.kind).toBe('upcoming-today')
    expect(after.kind).toBe('live-single')
  })
})

describe('selectFeaturedState — AC-11: pure / re-evaluation', () => {
  it('same inputs always produce equal outputs (pure)', () => {
    const matches = [makeMatch({ id: 'a' })]
    const now = Date.parse('2026-06-12T17:00:00Z')

    const a = selectFeaturedState(matches, now)
    const b = selectFeaturedState(matches, now)
    expect(a).toEqual(b)
  })

  it('re-evaluates to a new state when a new match is added for today', () => {
    const now = Date.parse('2026-06-12T17:00:00Z')
    const future = makeMatch({ id: 'fut', utcKickoff: '2026-06-14T19:00:00Z' })

    const before = selectFeaturedState([future], now)
    expect(before.kind).toBe('upcoming-future')

    const today = makeMatch({ id: 'tod', utcKickoff: '2026-06-12T22:00:00Z' })
    const after = selectFeaturedState([future, today], now)
    expect(after.kind).toBe('upcoming-today')
    if (after.kind === 'upcoming-today') {
      expect(after.match.id).toBe('tod')
    }
  })
})

describe('selectFeaturedState — source-status precedence', () => {
  it('a cancelled match whose kickoff is inside the live window does NOT become live', () => {
    const cancelled = makeMatch({
      id: 'cx',
      utcKickoff: '2026-06-12T19:00:00Z',
      status: 'cancelled',
    })
    const upcoming = makeMatch({
      id: 'up',
      utcKickoff: '2026-06-13T19:00:00Z',
    })
    const now = Date.parse('2026-06-12T19:20:00Z') // would be live by clock
    const state = selectFeaturedState([cancelled, upcoming], now)
    // No live, no today (today is 2026-06-12 BA local), so upcoming-future.
    expect(state.kind).toBe('upcoming-future')
    if (state.kind === 'upcoming-future') {
      expect(state.match.id).toBe('up')
    }
  })

  it('a postponed match is excluded from live/upcoming sets', () => {
    const postponed = makeMatch({
      id: 'px',
      utcKickoff: '2026-06-13T19:00:00Z',
      status: 'postponed',
    })
    const now = Date.parse('2026-06-12T17:00:00Z')
    expect(selectFeaturedState([postponed], now).kind).toBe('tournament-over')
  })

  it('a match with status=live is treated as live regardless of clock (data wins)', () => {
    const liveByData = makeMatch({
      id: 'lx',
      utcKickoff: '2026-06-12T23:00:00Z',
      status: 'live',
    })
    // Clock is 3h before kickoff — still live per data.
    const now = Date.parse('2026-06-12T20:00:00Z')
    const state = selectFeaturedState([liveByData], now)
    expect(state.kind).toBe('live-single')
    if (state.kind === 'live-single') {
      expect(state.match.id).toBe('lx')
    }
  })
})

describe('selectFeaturedState — integration with the bundled fixture', () => {
  it('returns upcoming-future pointing at the earliest still-scheduled match', () => {
    // 2026-06-10. Matchday 1 (Jun 11–14) is already finished in the
    // fixture, so the next UNPLAYED match is the earliest scheduled one:
    // wc2026-g-e-01 (Germany vs Curaçao, Jun 14), on a different local day
    // than `now` → upcoming-future.
    const now = Date.parse('2026-06-10T12:00:00Z')
    const state = selectFeaturedState(fixture, now)
    expect(state.kind).toBe('upcoming-future')
    if (state.kind === 'upcoming-future') {
      expect(state.match.id).toBe('wc2026-g-e-01')
    }
  })

  it('returns tournament-over after the final + live window', () => {
    // Real final is 2026-07-19T19:00:00Z (3 PM ET) at MetLife Stadium.
    const after = Date.parse('2026-07-19T19:00:00Z') + LIVE_WINDOW_MS + 1
    expect(selectFeaturedState(fixture, after).kind).toBe('tournament-over')
  })

  it('returns live-single during a solo scheduled match', () => {
    // wc2026-g-e-01: Germany vs Curaçao, 2026-06-14T17:00:00Z. The opening
    // matches are finished in the fixture; this is the first still-scheduled
    // match with no simultaneous kickoff, so ten minutes in it is the lone
    // live match.
    const now = Date.parse('2026-06-14T17:10:00Z')
    const state = selectFeaturedState(fixture, now)
    expect(state.kind).toBe('live-single')
    if (state.kind === 'live-single') {
      expect(state.match.id).toBe('wc2026-g-e-01')
    }
  })

  it('returns live-multiple when two same-kickoff matches are simultaneously live', () => {
    // The real schedule packs matchday 3 of every group into two simultaneous
    // pairs: e.g. Group A's last two matches both kick off at 2026-06-25T01:00:00Z
    // (Czechia vs Mexico + South Africa vs South Korea). Both are scheduled in
    // this fixture, so the algorithm should report live-multiple at that instant.
    const now = Date.parse('2026-06-25T01:10:00Z')
    const state = selectFeaturedState(fixture, now)
    expect(state.kind).toBe('live-multiple')
    if (state.kind === 'live-multiple') {
      expect(state.count).toBeGreaterThanOrEqual(2)
      const ids = state.matches.map((m) => m.id)
      expect(ids).toContain('wc2026-g-a-05')
      expect(ids).toContain('wc2026-g-a-06')
    }
  })
})
