import { describe, expect, it } from 'vitest'
import {
  TOURNAMENT_END_YMD,
  TOURNAMENT_START_YMD,
  dayBoundsForYMD,
  enumerateTournamentDays,
  ymdForNow,
} from '@/matches/domain/tournament-day'

// Vitest pins TZ=America/Argentina/Buenos_Aires (UTC-03:00, no DST) via
// vitest.config.ts → env.TZ. All assertions below assume that zone unless
// explicitly stated.

describe('enumerateTournamentDays', () => {
  it('returns exactly 39 days', () => {
    const days = enumerateTournamentDays(Date.parse('2026-06-15T12:00:00Z'))
    expect(days).toHaveLength(39)
  })

  it('day[0] is 1 / 2026-06-11 and day[38] is 39 / 2026-07-19', () => {
    const days = enumerateTournamentDays(Date.parse('2026-06-15T12:00:00Z'))
    expect(days[0]?.number).toBe(1)
    expect(days[0]?.dateYMD).toBe(TOURNAMENT_START_YMD)
    expect(days[38]?.number).toBe(39)
    expect(days[38]?.dateYMD).toBe(TOURNAMENT_END_YMD)
  })

  it('each day spans within [23h, 25h] (DST tolerance)', () => {
    const days = enumerateTournamentDays(Date.parse('2026-06-15T12:00:00Z'))
    const MIN = 23 * 3_600_000
    const MAX = 25 * 3_600_000
    for (const d of days) {
      const span = d.utcEndMs - d.utcStartMs
      expect(span).toBeGreaterThanOrEqual(MIN)
      expect(span).toBeLessThanOrEqual(MAX)
    }
  })

  it('dateYMD aligns with the BA-pinned host zone', () => {
    // In BA (UTC-03:00, no DST), local midnight 2026-06-11 is 2026-06-11T03:00:00Z.
    const days = enumerateTournamentDays(Date.parse('2026-06-15T12:00:00Z'))
    expect(days[0]?.utcStartMs).toBe(Date.parse('2026-06-11T03:00:00Z'))
    // Day after the last tournament day starts at 2026-07-20 local midnight.
    expect(days[38]?.utcEndMs).toBe(Date.parse('2026-07-20T03:00:00Z'))
  })

  it('day numbers form a 1..39 sequence with no gaps', () => {
    const days = enumerateTournamentDays(Date.parse('2026-06-15T12:00:00Z'))
    for (let i = 0; i < days.length; i++) {
      expect(days[i]?.number).toBe(i + 1)
    }
  })
})

describe('dayBoundsForYMD', () => {
  it('resolves the local-midnight bounds for a YMD', () => {
    const { utcStartMs, utcEndMs } = dayBoundsForYMD('2026-06-15')
    expect(utcStartMs).toBe(Date.parse('2026-06-15T03:00:00Z'))
    expect(utcEndMs).toBe(Date.parse('2026-06-16T03:00:00Z'))
  })
})

describe('ymdForNow', () => {
  it('returns the host-local YYYY-MM-DD for the given wall-clock ms', () => {
    // 2026-06-12T01:00:00Z = 22:00 BA on 2026-06-11.
    expect(ymdForNow(Date.parse('2026-06-12T01:00:00Z'))).toBe('2026-06-11')
    // 2026-06-12T05:00:00Z = 02:00 BA on 2026-06-12.
    expect(ymdForNow(Date.parse('2026-06-12T05:00:00Z'))).toBe('2026-06-12')
  })
})
