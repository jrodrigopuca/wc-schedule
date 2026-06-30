import { describe, expect, it } from 'vitest'
import type { Match, Stage } from '@/matches/domain/match'
import { buildMatchIcs, type IcsRenderContext } from '@/matches/domain/ics'

const NOW = Date.parse('2026-06-14T09:30:45Z')

const baseMatch: Match = {
  id: 'wc2026-g-c-01',
  utcKickoff: '2026-06-25T19:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'C',
  teamA: { iso: 'ar', name: 'Argentina' },
  teamB: { iso: 'ma', name: 'Marruecos' },
  venue: { city: 'Los Angeles', country: 'United States' },
}

const TEAM_NAMES_ES: Record<string, string> = {
  ar: 'Argentina',
  ma: 'Marruecos',
}

const STAGE_LABELS_ES: Record<Stage, string> = {
  group: 'Fase de grupos',
  'round-of-32': '32avos',
  'round-of-16': '16avos',
  'quarter-final': 'Cuartos',
  'semi-final': 'Semifinales',
  'third-place': 'Tercer puesto',
  final: 'Final',
}

const ctxEs: IcsRenderContext = {
  resolveTeamName: (iso, fb) => TEAM_NAMES_ES[iso] ?? fb,
  resolveStageLabel: (s) => STAGE_LABELS_ES[s],
  appUrl: 'https://example.test/wc-schedule/',
}

describe('buildMatchIcs', () => {
  it('emits a well-formed VCALENDAR / VEVENT envelope', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('CALSCALE:GREGORIAN')
    expect(ics).toContain('METHOD:PUBLISH')
  })

  it('uses CRLF line endings (RFC 5545 requirement)', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics.split('\r\n').length).toBeGreaterThan(1)
  })

  it('writes a stable UID derived from the match id', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('UID:wc2026-g-c-01@wc-schedule.app')
  })

  it('writes DTSTAMP equal to `now` in UTC compact form', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('DTSTAMP:20260614T093045Z')
  })

  it('writes DTSTART derived from match.utcKickoff', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('DTSTART:20260625T190000Z')
  })

  it('writes DTEND = DTSTART + 120 minutes', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('DTEND:20260625T210000Z')

    // Round-trip parse and confirm the delta in minutes.
    const dtStart = extractField(ics, 'DTSTART')
    const dtEnd = extractField(ics, 'DTEND')
    const startMs = parseIcsDate(dtStart)
    const endMs = parseIcsDate(dtEnd)
    expect((endMs - startMs) / 60_000).toBe(120)
  })

  it('SUMMARY resolves team names through ctx (locale-aware)', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('SUMMARY:Argentina vs Marruecos')
  })

  it('SUMMARY uses English names when ctx resolves to English', () => {
    const ctxEn: IcsRenderContext = {
      resolveTeamName: (iso, fb) => ({ ar: 'Argentina', ma: 'Morocco' })[iso] ?? fb,
      resolveStageLabel: () => 'Group stage',
      appUrl: ctxEs.appUrl,
    }
    const ics = buildMatchIcs(baseMatch, ctxEn, NOW)
    expect(ics).toContain('SUMMARY:Argentina vs Morocco')
  })

  it('DESCRIPTION embeds the stage label and "Grupo X" suffix when present', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('DESCRIPTION:Fase de grupos · Grupo C · Mundial 2026')
  })

  it('DESCRIPTION omits the "Grupo X" suffix for knockout stages', () => {
    const { group: _g, ...rest } = baseMatch
    void _g
    const knockout: Match = {
      ...rest,
      stage: 'quarter-final',
    }
    const ics = buildMatchIcs(knockout, ctxEs, NOW)
    expect(ics).toContain('DESCRIPTION:Cuartos · Mundial 2026')
    expect(ics).not.toContain('Grupo')
  })

  it('escapes ICS special characters in SUMMARY, DESCRIPTION, LOCATION', () => {
    const tricky: Match = {
      ...baseMatch,
      teamA: { iso: 'ar', name: 'A, B; C\\D' },
      venue: { city: 'Some, City', country: 'A\\Country\nMulti' },
    }
    const ctx: IcsRenderContext = {
      // Force the fallback path to surface the raw, unescaped chars.
      resolveTeamName: (_iso, fb) => fb,
      resolveStageLabel: () => 'Fase\nde\\grupos;raro,si',
      appUrl: ctxEs.appUrl,
    }
    const ics = buildMatchIcs(tricky, ctx, NOW)

    expect(ics).toContain('A\\, B\\; C\\\\D')
    expect(ics).toContain('Fase\\nde\\\\grupos\\;raro\\,si')
    expect(ics).toContain('Some\\, City')
    expect(ics).toContain('A\\\\Country\\nMulti')
  })

  it('omits the LOCATION line entirely when the match has no venue', () => {
    // `exactOptionalPropertyTypes` rejects `venue: undefined`; destructure
    // it out instead.
    const { venue: _v, ...rest } = baseMatch
    void _v
    const noVenue: Match = rest
    const ics = buildMatchIcs(noVenue, ctxEs, NOW)
    expect(ics).not.toContain('LOCATION:')
  })

  it('emits URL and STATUS fields', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('URL:https://example.test/wc-schedule/')
    expect(ics).toContain('STATUS:CONFIRMED')
  })

  it('emits the PRODID identifier', () => {
    const ics = buildMatchIcs(baseMatch, ctxEs, NOW)
    expect(ics).toContain('PRODID:-//WC Schedule//Mundial 2026//EN')
  })
})

function extractField(ics: string, field: string): string {
  const line = ics.split('\r\n').find((l) => l.startsWith(`${field}:`))
  if (line === undefined) throw new Error(`field ${field} not found`)
  return line.slice(field.length + 1)
}

function parseIcsDate(value: string): number {
  // YYYYMMDDTHHMMSSZ
  const yyyy = Number(value.slice(0, 4))
  const mm = Number(value.slice(4, 6)) - 1
  const dd = Number(value.slice(6, 8))
  const hh = Number(value.slice(9, 11))
  const mi = Number(value.slice(11, 13))
  const ss = Number(value.slice(13, 15))
  return Date.UTC(yyyy, mm, dd, hh, mi, ss)
}
