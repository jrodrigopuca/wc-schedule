import { describe, expect, it } from 'vitest'
import type { Match } from '@/matches/domain/match'
import { byKickoffThenId } from '@/matches/domain/sort'

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'wc2026-x',
    utcKickoff: '2026-06-12T19:00:00Z',
    status: 'scheduled',
    stage: 'group',
    teamA: { iso: 'ar', name: 'Argentina' },
    teamB: { iso: 'br', name: 'Brasil' },
    ...overrides,
  }
}

describe('byKickoffThenId', () => {
  it('AC-3: orders by kickoff ascending', () => {
    const a = makeMatch({ id: 'a', utcKickoff: '2026-06-12T22:00:00Z' })
    const b = makeMatch({ id: 'b', utcKickoff: '2026-06-12T19:00:00Z' })
    const c = makeMatch({ id: 'c', utcKickoff: '2026-06-12T20:30:00Z' })

    const sorted = [a, b, c].slice().sort(byKickoffThenId)
    expect(sorted.map((m) => m.id)).toEqual(['b', 'c', 'a'])
  })

  it('AC-3 tiebreaker: same kickoff orders by id ascending', () => {
    const a = makeMatch({ id: 'wc-zzz', utcKickoff: '2026-06-12T19:00:00Z' })
    const b = makeMatch({ id: 'wc-aaa', utcKickoff: '2026-06-12T19:00:00Z' })

    const sorted = [a, b].slice().sort(byKickoffThenId)
    expect(sorted.map((m) => m.id)).toEqual(['wc-aaa', 'wc-zzz'])
  })

  it('is stable for already-ordered input', () => {
    const a = makeMatch({ id: '1', utcKickoff: '2026-06-12T19:00:00Z' })
    const b = makeMatch({ id: '2', utcKickoff: '2026-06-12T20:00:00Z' })
    const sorted = [a, b].slice().sort(byKickoffThenId)
    expect(sorted).toEqual([a, b])
  })
})
