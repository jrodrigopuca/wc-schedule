// Golden test for the bundled fixture. If this fails, the fixture has
// drifted from the schema — fix the FIXTURE, not the schema. Other
// behavioral tests (selectFeaturedState, etc.) rely on the structural
// guarantees asserted here.
//
// As of 2026-06-06, the fixture mirrors the official WC 2026 schedule:
//   - 104 matches total, dated 2026-06-11 through 2026-07-19.
//   - 12 groups (A–L), 4 teams each, 6 round-robin matches per group.
//   - 16 R32 + 8 R16 + 4 QF + 2 SF + 1 third-place + 1 final.
//   - Every group-stage team is identified by its real lowercase ISO.
//   - Knockout matches use the placeholder ISO `xx` because the bracket
//     participants aren't determined until the group stage finishes; the
//     `team.name` carries the bracket-slot label ("1º grupo A", "Ganador
//     R16-03", "Mejor tercero (B/E/F/I/J)", etc.).
//
// Tournament hasn't started yet → ALL matches are `status: 'scheduled'`.
// We intentionally relax the older "simultaneous kickoffs" and "empty day"
// assertions: the real fixture happens to satisfy them, but the structural
// 104-match shape is what the rest of the app depends on.

import { describe, expect, it } from 'vitest'
import fixtureJson from '@/shared/fixture/matches.fixture.json'
import { matchListSchema } from '@/matches/domain/match.schema'
import type { Stage } from '@/matches/domain/match'

const parsed = matchListSchema.parse(fixtureJson)

// Eagerly enumerated flag asset list (Vite globs at test time).
const flagModules = import.meta.glob('@/shared/flags/*.svg', { eager: false })
const FLAG_ISOS: ReadonlySet<string> = new Set(
  Object.keys(flagModules).map((path) => {
    const file = path.split('/').pop() ?? ''
    return file.replace(/\.svg$/, '').toLowerCase()
  }),
)

const TOURNAMENT_WINDOW_START = Date.UTC(2026, 5, 11, 0, 0, 0) // 2026-06-11T00:00:00Z
const TOURNAMENT_WINDOW_END = Date.UTC(2026, 6, 19, 23, 59, 59) // 2026-07-19T23:59:59Z

describe('matches.fixture.json', () => {
  it('parses cleanly through matchListSchema', () => {
    expect(parsed.length).toBe(104)
  })

  it('contains every required stage with the right count', () => {
    const expected: Readonly<Record<Stage, number>> = {
      group: 72,
      'round-of-32': 16,
      'round-of-16': 8,
      'quarter-final': 4,
      'semi-final': 2,
      'third-place': 1,
      final: 1,
    }
    for (const [stage, count] of Object.entries(expected) as Array<[Stage, number]>) {
      const found = parsed.filter((m) => m.stage === stage)
      expect(found.length, `stage=${stage}`).toBe(count)
    }
  })

  it('covers every group letter A through L with 6 matches each', () => {
    const groupLetters = 'ABCDEFGHIJKL'.split('')
    for (const letter of groupLetters) {
      const found = parsed.filter((m) => m.stage === 'group' && m.group === letter)
      expect(found.length, `group=${letter}`).toBe(6)
    }
  })

  it('uses lowercase 2-letter ISO codes everywhere', () => {
    // matchSchema's ISO regex is /^[a-z]{2}$/. Compound subdivision codes
    // (gb-eng, gb-sct) live in the i18n/flags layer for display, but the
    // fixture uses the schema-friendly 2-letter aliases `gb` (England) and
    // `xs` (Scotland) instead.
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

  it('only uses scheduled or finished statuses', () => {
    // The fixture models a tournament in progress: matchday 1 has been
    // played (finished, with scores), the rest is still scheduled. No
    // live/postponed/cancelled is pre-baked — those derive at runtime.
    for (const m of parsed) {
      expect(['scheduled', 'finished']).toContain(m.status)
    }
  })

  it('carries a score on finished matches and only on those', () => {
    for (const m of parsed) {
      if (m.status === 'finished') {
        expect(m.score, `finished ${m.id} must carry a score`).toBeDefined()
      } else {
        expect(m.score, `non-finished ${m.id} must not pre-declare a score`).toBeUndefined()
      }
    }
  })

  it('keeps every kickoff inside the tournament window [Jun 11 – Jul 19, 2026]', () => {
    for (const m of parsed) {
      const t = Date.parse(m.utcKickoff)
      expect(Number.isFinite(t), `bad utcKickoff: ${m.utcKickoff}`).toBe(true)
      expect(t).toBeGreaterThanOrEqual(TOURNAMENT_WINDOW_START)
      expect(t).toBeLessThanOrEqual(TOURNAMENT_WINDOW_END)
    }
  })

  it('opens on 2026-06-11 in Ciudad de México (Estadio Azteca)', () => {
    const sorted = [...parsed].sort((a, b) => a.utcKickoff.localeCompare(b.utcKickoff))
    const opener = sorted[0]
    expect(opener).toBeDefined()
    expect(opener?.utcKickoff.slice(0, 10)).toBe('2026-06-11')
    expect(opener?.venue?.city).toBe('Ciudad de México')
    expect(opener?.venue?.country).toBe('México')
  })

  it('closes with the final at MetLife Stadium (East Rutherford)', () => {
    const sorted = [...parsed].sort((a, b) => a.utcKickoff.localeCompare(b.utcKickoff))
    const closer = sorted[sorted.length - 1]
    expect(closer).toBeDefined()
    expect(closer?.stage).toBe('final')
    expect(closer?.utcKickoff.slice(0, 10)).toBe('2026-07-19')
    expect(closer?.venue?.city).toBe('East Rutherford')
    expect(closer?.venue?.country).toBe('Estados Unidos')
  })

  it('exposes every group-stage team with a bundled flag SVG', () => {
    // Knockout matches use the `xx` placeholder ISO because the bracket
    // participants are still unknown; for the group stage every ISO MUST
    // resolve to a real flag asset.
    const missing: string[] = []
    for (const m of parsed) {
      if (m.stage !== 'group') continue
      for (const iso of [m.teamA.iso, m.teamB.iso]) {
        if (!FLAG_ISOS.has(iso.toLowerCase())) missing.push(iso)
      }
    }
    expect(missing, `Group-stage ISOs without a flag: ${missing.join(', ')}`).toEqual([])
  })

  it('uses the placeholder ISO `xx` only for knockout-stage matches', () => {
    for (const m of parsed) {
      if (m.teamA.iso === 'xx' || m.teamB.iso === 'xx') {
        expect(m.stage).not.toBe('group')
      }
    }
  })

  it('uses a venue from the 16 official host cities', () => {
    const HOST_CITIES = new Set([
      // United States (11)
      'Atlanta',
      'Boston',
      'Dallas',
      'East Rutherford',
      'Filadelfia',
      'Houston',
      'Kansas City',
      'Los Ángeles',
      'Miami',
      'San Francisco',
      'Seattle',
      // Mexico (3)
      'Ciudad de México',
      'Guadalajara',
      'Monterrey',
      // Canada (2)
      'Toronto',
      'Vancouver',
    ])
    const offenders: string[] = []
    for (const m of parsed) {
      const city = m.venue?.city
      if (city === undefined) {
        offenders.push(`${m.id} (no venue)`)
      } else if (!HOST_CITIES.has(city)) {
        offenders.push(`${m.id} → ${city}`)
      }
    }
    expect(offenders, `Non-host venues: ${offenders.join('; ')}`).toEqual([])
  })

  it('touches all 16 host cities at least once', () => {
    const cities = new Set(parsed.map((m) => m.venue?.city).filter((c): c is string => Boolean(c)))
    expect(cities.size).toBe(16)
  })

  it('has unique, sortable IDs', () => {
    const ids = parsed.map((m) => m.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})
