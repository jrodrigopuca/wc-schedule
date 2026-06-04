import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetClockForTests, __setClockForTests, getNow } from '@/shared/time/now'
import { isSameLocalDay, isToday, todayBounds } from '@/matches/domain/today'

// Vitest pins TZ=America/Argentina/Buenos_Aires (UTC-03:00, no DST) globally
// via vitest.config.ts → env.TZ. All assertions below assume that zone unless
// explicitly mutated via process.env.TZ.

describe('todayBounds', () => {
  afterEach(() => {
    __resetClockForTests()
  })

  it('starts at local midnight and spans 24h in epoch ms', () => {
    // 2026-06-12T15:30:00-03:00 (BA local) → 2026-06-12T18:30:00Z
    const now = Date.parse('2026-06-12T18:30:00Z')
    __setClockForTests(() => now)

    const { startMs, endMs } = todayBounds(getNow())

    // local midnight in BA (UTC-03:00) is 03:00Z of the same UTC day.
    expect(startMs).toBe(Date.parse('2026-06-12T03:00:00Z'))
    expect(endMs - startMs).toBe(86_400_000)
  })
})

describe('isToday', () => {
  it('AC-1: a kickoff at 23:59 local stays today', () => {
    const now = Date.parse('2026-06-12T20:00:00Z') // 17:00 BA
    // 23:59 BA on 2026-06-12 → 02:59Z on 2026-06-13.
    const kickoff = '2026-06-13T02:59:00Z'
    expect(isToday(kickoff, now)).toBe(true)
  })

  it('AC-1 inverse: a kickoff at 00:00 of the next local day is NOT today', () => {
    const now = Date.parse('2026-06-12T20:00:00Z')
    // 00:00 BA on 2026-06-13 → 03:00Z on 2026-06-13.
    const kickoff = '2026-06-13T03:00:00Z'
    expect(isToday(kickoff, now)).toBe(false)
  })

  it('AC-5: a match that starts today but ends after midnight is still attributed to today (by start)', () => {
    const now = Date.parse('2026-06-13T02:00:00Z') // 23:00 BA on 2026-06-12
    // Started at 22:30 BA → 01:30Z. Now is 23:00 BA (02:00Z), so kickoff is in
    // the same local day as `now`.
    const kickoff = '2026-06-13T01:30:00Z'
    expect(isToday(kickoff, now)).toBe(true)
  })

  it('isSameLocalDay is an alias for isToday', () => {
    const now = Date.parse('2026-06-12T20:00:00Z')
    const kickoff = '2026-06-12T22:00:00Z'
    expect(isSameLocalDay(kickoff, now)).toBe(isToday(kickoff, now))
  })

  it('DST-safe (acknowledged): endMs - startMs is always 86_400_000', () => {
    // BA does not observe DST today, so we exercise the host-side guarantee
    // directly on a known US spring-forward instant. The host TZ is BA so the
    // window is exactly 24h regardless of the input day. This documents the
    // "+24h step is accepted on DST days" behavior from design §11.
    const dstSpringForwardUtc = Date.parse('2026-03-08T15:00:00Z')
    const { startMs, endMs } = todayBounds(dstSpringForwardUtc)
    expect(endMs - startMs).toBe(86_400_000)
  })
})

describe('isToday (half-hour offset)', () => {
  // The default vitest TZ is BA. We swap TZ via globalThis to exercise the
  // half-hour-offset zone (Asia/Kolkata, UTC+05:30, no DST) per matches.md
  // AC-2. The TZ env mutation only affects Date constructors that use the
  // host zone (`new Date(y, m, d)`), which is exactly what todayBounds reads.
  // The cast goes through `globalThis` instead of importing @types/node so
  // the build's tsconfig.app.json doesn't need node typings.
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
    .process.env
  const originalTz = env['TZ']

  beforeEach(() => {
    env['TZ'] = 'Asia/Kolkata'
  })

  afterEach(() => {
    env['TZ'] = originalTz
  })

  it('AC-2: respects the 30-minute offset exactly', () => {
    // 2026-06-12T10:00:00Z = 15:30 IST on 2026-06-12.
    // Local midnight (00:00 IST) is 18:30Z on 2026-06-11.
    const now = Date.parse('2026-06-12T10:00:00Z')
    const { startMs, endMs } = todayBounds(now)
    expect(startMs).toBe(Date.parse('2026-06-11T18:30:00Z'))
    expect(endMs).toBe(Date.parse('2026-06-12T18:30:00Z'))

    // 23:45 IST on 2026-06-12 → 18:15Z on 2026-06-12 → still in today's window.
    expect(isToday('2026-06-12T18:15:00Z', now)).toBe(true)
    // 00:00 IST on 2026-06-13 → 18:30Z on 2026-06-12 → next local day.
    expect(isToday('2026-06-12T18:30:00Z', now)).toBe(false)
  })
})
