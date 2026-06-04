// Golden test for the bundled fixture. If this fails, the fixture has
// drifted from the schema — fix the FIXTURE, not the schema. Other
// behavioral tests (selectFeaturedState, etc.) rely on the structural
// guarantees asserted here.

import { describe, expect, it } from 'vitest'
import fixtureJson from '@/shared/fixture/matches.fixture.json'
import { matchListSchema } from '@/matches/domain/match.schema'
import type { Stage } from '@/matches/domain/match'

const parsed = matchListSchema.parse(fixtureJson)

describe('matches.fixture.json', () => {
  it('parses cleanly through matchListSchema', () => {
    expect(parsed.length).toBeGreaterThanOrEqual(40)
    expect(parsed.length).toBeLessThanOrEqual(48)
  })

  it('contains at least one match in every required stage', () => {
    const requiredStages: readonly Stage[] = [
      'group',
      'round-of-32',
      'round-of-16',
      'quarter-final',
      'semi-final',
      'third-place',
      'final',
    ]
    for (const stage of requiredStages) {
      const found = parsed.filter((m) => m.stage === stage)
      expect(found.length, `stage=${stage}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('covers every group letter A through L', () => {
    const groupLetters = 'ABCDEFGHIJKL'.split('')
    for (const letter of groupLetters) {
      const found = parsed.filter((m) => m.stage === 'group' && m.group === letter)
      expect(found.length, `group=${letter}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('uses lowercase ISO codes everywhere', () => {
    for (const m of parsed) {
      expect(m.teamA.iso).toMatch(/^[a-z]{2}$/)
      expect(m.teamB.iso).toMatch(/^[a-z]{2}$/)
    }
  })

  it('uses an explicit UTC marker (`Z`) on every kickoff', () => {
    for (const m of parsed) {
      expect(m.utcKickoff.endsWith('Z')).toBe(true)
    }
  })

  it('has at least one finished match (state mix)', () => {
    const finished = parsed.filter((m) => m.status === 'finished')
    expect(finished.length).toBeGreaterThanOrEqual(1)
    for (const m of finished) {
      expect(m.score).toBeDefined()
    }
  })

  it('has zero pre-declared live matches (live is computed)', () => {
    const liveDeclared = parsed.filter((m) => m.status === 'live')
    expect(liveDeclared).toHaveLength(0)
  })

  it('has at least one pair of simultaneous kickoffs (multi-live scenario)', () => {
    const byTime = new Map<string, number>()
    for (const m of parsed) {
      byTime.set(m.utcKickoff, (byTime.get(m.utcKickoff) ?? 0) + 1)
    }
    const simultaneousCount = Array.from(byTime.values()).filter((n) => n >= 2).length
    expect(simultaneousCount).toBeGreaterThanOrEqual(1)
  })

  it('has at least one empty day inside the tournament window', () => {
    // Build the set of UTC kickoff dates that DO have matches.
    const daysWithMatches = new Set(parsed.map((m) => m.utcKickoff.slice(0, 10)))
    // Walk the tournament window [2026-06-11, 2026-07-19] and find a gap.
    const START = Date.UTC(2026, 5, 11) // June is month index 5
    const END = Date.UTC(2026, 6, 19)
    const DAY_MS = 24 * 60 * 60 * 1000
    let foundEmpty = false
    for (let t = START; t <= END; t += DAY_MS) {
      const iso = new Date(t).toISOString().slice(0, 10)
      if (!daysWithMatches.has(iso)) {
        foundEmpty = true
        break
      }
    }
    expect(foundEmpty).toBe(true)
  })
})
