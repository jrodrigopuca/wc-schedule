import { describe, expect, it } from 'vitest'
import { assertNever, type FeaturedState } from '@/featured/domain/featured-state'
import type { Match } from '@/matches/domain/match'

const fixtureMatch: Match = {
  id: 'wc2026-001',
  utcKickoff: '2026-06-11T20:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'A',
  teamA: { iso: 'mx', name: 'México' },
  teamB: { iso: 'ar', name: 'Argentina' },
}

function describeState(state: FeaturedState): string {
  switch (state.kind) {
    case 'live-single':
      return `live-single:${state.match.id}`
    case 'live-multiple':
      return `live-multiple:${state.count}`
    case 'upcoming-today':
      return `upcoming-today:${state.match.id}:${state.msUntilKickoff}`
    case 'upcoming-future':
      return `upcoming-future:${state.match.id}:${state.msUntilKickoff}`
    case 'tournament-over':
      return 'tournament-over'
    default:
      return assertNever(state)
  }
}

describe('FeaturedState', () => {
  it('describes every variant via an exhaustive switch', () => {
    const states: readonly FeaturedState[] = [
      { kind: 'live-single', match: fixtureMatch },
      { kind: 'live-multiple', count: 2, matches: [fixtureMatch] },
      {
        kind: 'upcoming-today',
        match: fixtureMatch,
        msUntilKickoff: 3_600_000,
      },
      {
        kind: 'upcoming-future',
        match: fixtureMatch,
        msUntilKickoff: 86_400_000,
      },
      { kind: 'tournament-over' },
    ]

    const out = states.map(describeState)

    expect(out).toEqual([
      'live-single:wc2026-001',
      'live-multiple:2',
      'upcoming-today:wc2026-001:3600000',
      'upcoming-future:wc2026-001:86400000',
      'tournament-over',
    ])
  })
})

describe('assertNever', () => {
  it('throws when reached', () => {
    expect(() => assertNever('unexpected' as unknown as never)).toThrow(/assertNever/)
  })
})
