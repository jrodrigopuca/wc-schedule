import { describe, expect, it } from 'vitest'
import { matchListSchema, matchSchema } from '@/matches/domain/match.schema'

const validFull = {
  id: 'wc2026-001',
  utcKickoff: '2026-06-11T20:00:00Z',
  status: 'scheduled' as const,
  stage: 'group' as const,
  group: 'A',
  teamA: { iso: 'mx', name: 'México' },
  teamB: { iso: 'ar', name: 'Argentina' },
  score: { home: 0, away: 0 },
  penalties: { home: 5, away: 4 },
  venue: { city: 'Ciudad de México', country: 'México' },
}

const validMinimal = {
  id: 'wc2026-040',
  utcKickoff: '2026-07-12T19:00:00Z',
  status: 'scheduled' as const,
  stage: 'final' as const,
  teamA: { iso: 'br', name: 'Brasil' },
  teamB: { iso: 'fr', name: 'Francia' },
}

describe('matchSchema', () => {
  it('accepts a valid match with every optional field', () => {
    const result = matchSchema.safeParse(validFull)
    expect(result.success).toBe(true)
  })

  it('accepts a valid match without optional fields', () => {
    const result = matchSchema.safeParse(validMinimal)
    expect(result.success).toBe(true)
  })

  it('rejects a payload missing utcKickoff', () => {
    const { utcKickoff: _utc, ...rest } = validFull
    const result = matchSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects a utcKickoff with lowercase `z` suffix', () => {
    const result = matchSchema.safeParse({
      ...validFull,
      utcKickoff: '2026-06-11T20:00:00z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a status value outside the enum', () => {
    const result = matchSchema.safeParse({
      ...validFull,
      status: 'in-progress',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a stage value outside the enum', () => {
    const result = matchSchema.safeParse({
      ...validFull,
      stage: 'final-final',
    })
    expect(result.success).toBe(false)
  })

  it('accepts the round-of-32 stage (WC 2026 48-team bracket)', () => {
    const result = matchSchema.safeParse({
      ...validFull,
      stage: 'round-of-32',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a lowercase group letter', () => {
    const result = matchSchema.safeParse({
      ...validFull,
      group: 'a',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an uppercase iso code', () => {
    const result = matchSchema.safeParse({
      ...validFull,
      teamA: { iso: 'AR', name: 'Argentina' },
    })
    expect(result.success).toBe(false)
  })
})

describe('matchListSchema', () => {
  it('accepts an empty list', () => {
    expect(matchListSchema.parse([])).toEqual([])
  })

  it('accepts a list of valid matches', () => {
    const parsed = matchListSchema.parse([validFull, validMinimal])
    expect(parsed).toHaveLength(2)
  })
})
