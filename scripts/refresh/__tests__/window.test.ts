import { describe, it, expect } from 'vitest'
import { getRefreshMode, shouldFetch, utcMidnight } from '../window.ts'

// Tournament window: 2026-06-11 … 2026-07-19 (inclusive).
// Near window: 30 days before kickoff … 7 days after the final.
//   near start = 2026-05-12, near end = 2026-07-26.

describe('getRefreshMode — boundary cases', () => {
  const cases: ReadonlyArray<readonly [string, ReturnType<typeof getRefreshMode>]> = [
    ['2026-06-11', 'tournament'], // inclusive start
    ['2026-07-19', 'tournament'], // inclusive end
    ['2026-07-01', 'tournament'], // mid-tournament
    ['2026-06-10', 'near'], // day before kickoff
    ['2026-07-20', 'near'], // day after the final
    ['2026-05-12', 'near'], // exact near-start boundary (start - 30d)
    ['2026-07-26', 'near'], // exact near-end boundary (end + 7d)
    ['2026-05-11', 'off'], // one day before near-start
    ['2026-07-27', 'off'], // one day after near-end
    ['2026-01-01', 'off'], // deep off-season
  ]

  for (const [date, expected] of cases) {
    it(`${date} → ${expected}`, () => {
      expect(getRefreshMode(utcMidnight(date))).toBe(expected)
    })
  }
})

describe('shouldFetch — cadence table', () => {
  const day = (iso: string) => utcMidnight(iso)

  it('off mode never fetches, even with no prior refresh', () => {
    expect(shouldFetch('off', day('2026-06-12'), null)).toBe(false)
  })

  it('first-ever run always fetches (tournament)', () => {
    expect(shouldFetch('tournament', day('2026-06-12'), null)).toBe(true)
  })

  it('first-ever run always fetches (near)', () => {
    expect(shouldFetch('near', day('2026-06-01'), null)).toBe(true)
  })

  it('tournament: always fetches, even within the same UTC day (~4h cadence)', () => {
    // The cron fires every ~4h; during the tournament every run fetches so
    // results and bracket slots go live fast. The no-change short-circuit in
    // rotate.ts absorbs unchanged re-fetches (no commit), so this is cheap.
    expect(shouldFetch('tournament', day('2026-06-12'), day('2026-06-12'))).toBe(true)
  })

  it('tournament: fetches regardless of how long since the last refresh', () => {
    expect(shouldFetch('tournament', day('2026-06-12'), day('2026-06-11'))).toBe(true)
  })

  it('near: 1 day elapsed → skip (48h cadence)', () => {
    expect(shouldFetch('near', day('2026-06-02'), day('2026-06-01'))).toBe(false)
  })

  it('near: 2 days elapsed → fetch', () => {
    expect(shouldFetch('near', day('2026-06-03'), day('2026-06-01'))).toBe(true)
  })
})
