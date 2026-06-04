import { describe, expect, it } from 'vitest'
import { formatDate, formatRelativeDay, formatTime } from '@/shared/time/format'

const ISO = '2026-06-18T19:00:00Z'
const DAY_MS = 24 * 60 * 60 * 1000

describe('formatTime', () => {
  it('returns HH:mm in 24-hour notation for es-AR', () => {
    const value = formatTime(ISO, 'es-AR')
    // 19:00Z in America/Argentina/Buenos_Aires (UTC-03) is 16:00 local.
    expect(value).toMatch(/^\d{2}:\d{2}$/)
    expect(value).toBe('16:00')
  })
})

describe('formatDate', () => {
  it('returns weekday + day + month short for es-AR', () => {
    const value = formatDate(ISO, 'es-AR')
    expect(value.toLowerCase()).toContain('jue')
    expect(value).toContain('18')
    expect(value.toLowerCase()).toContain('jun')
  })
})

describe('formatRelativeDay', () => {
  it('returns "hoy" when the kickoff is on the same local day as now', () => {
    const now = new Date(ISO).getTime()
    expect(formatRelativeDay(ISO, now)).toBe('hoy')
  })

  it('returns "mañana" when the kickoff is on the next local day', () => {
    const now = new Date(ISO).getTime() - DAY_MS
    expect(formatRelativeDay(ISO, now)).toBe('mañana')
  })

  it('returns "pasado" when the kickoff is two days ahead', () => {
    const now = new Date(ISO).getTime() - 2 * DAY_MS
    expect(formatRelativeDay(ISO, now)).toBe('pasado')
  })

  it('falls back to a formatted date for anything beyond pasado', () => {
    const now = new Date(ISO).getTime() - 3 * DAY_MS
    const value = formatRelativeDay(ISO, now, 'es-AR')
    expect(value).not.toBe('hoy')
    expect(value).not.toBe('mañana')
    expect(value).not.toBe('pasado')
    expect(value.toLowerCase()).toContain('jun')
  })
})
