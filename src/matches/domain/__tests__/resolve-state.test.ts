import { describe, expect, it } from 'vitest'
import type { Match } from '@/matches/domain/match'
import { resolveState } from '@/matches/domain/resolve-state'

const KICKOFF = '2026-06-12T20:00:00Z'
const KICKOFF_MS = Date.parse(KICKOFF)
const LIVE_WINDOW_MS = 110 * 60_000

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'wc2026-001',
    utcKickoff: KICKOFF,
    status: 'scheduled',
    stage: 'group',
    teamA: { iso: 'ar', name: 'Argentina' },
    teamB: { iso: 'br', name: 'Brasil' },
    ...overrides,
  }
}

describe('resolveState — scheduled source status (clock-derived)', () => {
  it('returns "scheduled" when now is before kickoff', () => {
    const match = makeMatch({ status: 'scheduled' })
    expect(resolveState(match, KICKOFF_MS - 1)).toBe('scheduled')
  })

  it('AC-9: returns "live" when now is inside the live window', () => {
    const match = makeMatch({ status: 'scheduled' })
    // 30 minutes after kickoff: well inside the 110-min window.
    expect(resolveState(match, KICKOFF_MS + 30 * 60_000)).toBe('live')
  })

  it('returns "live" at the exact kickoff instant (boundary inclusive)', () => {
    const match = makeMatch({ status: 'scheduled' })
    expect(resolveState(match, KICKOFF_MS)).toBe('live')
  })

  it('returns "finished" once the live window has elapsed', () => {
    const match = makeMatch({ status: 'scheduled' })
    expect(resolveState(match, KICKOFF_MS + LIVE_WINDOW_MS)).toBe('finished')
    expect(resolveState(match, KICKOFF_MS + LIVE_WINDOW_MS + 1)).toBe('finished')
  })
})

describe('resolveState — data-wins precedence (AC-10)', () => {
  it('keeps "cancelled" even when clock is inside the live window', () => {
    const match = makeMatch({ status: 'cancelled' })
    expect(resolveState(match, KICKOFF_MS + 30 * 60_000)).toBe('cancelled')
  })

  it('keeps "postponed" regardless of clock', () => {
    const match = makeMatch({ status: 'postponed' })
    expect(resolveState(match, KICKOFF_MS - 1)).toBe('postponed')
    expect(resolveState(match, KICKOFF_MS + 1)).toBe('postponed')
  })

  it('keeps "finished" even when clock is before kickoff (data wins)', () => {
    const match = makeMatch({ status: 'finished' })
    expect(resolveState(match, KICKOFF_MS - 10_000)).toBe('finished')
  })

  it('keeps "live" override even when clock is far before kickoff', () => {
    const match = makeMatch({ status: 'live' })
    // 3h before kickoff: clock says scheduled, data says live → data wins.
    expect(resolveState(match, KICKOFF_MS - 3 * 60 * 60_000)).toBe('live')
  })
})
