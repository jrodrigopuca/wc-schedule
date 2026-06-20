import { describe, it, expect } from 'vitest'
import { transform, type UpstreamResponse } from '../transform.ts'
import { matchListSchema } from '../../../src/matches/domain/match.schema.ts'

const groupMatch = {
  id: 1,
  utcDate: '2026-06-11T19:00:00Z',
  status: 'SCHEDULED',
  stage: 'GROUP_STAGE',
  group: 'GROUP_A',
  homeTeam: { id: 1, name: 'Mexico' },
  awayTeam: { id: 2, name: 'Canada' },
}

const finalMatch = {
  id: 99,
  utcDate: '2026-07-19T19:00:00Z',
  status: 'FINISHED',
  stage: 'FINAL',
  group: null,
  homeTeam: { id: 3, name: 'Argentina' },
  awayTeam: { id: 4, name: 'France' },
  score: { fullTime: { home: 3, away: 2 } },
}

describe('transform — happy path', () => {
  it('produces a Zod-valid Match[] the client schema accepts', () => {
    const out = transform({ matches: [groupMatch, finalMatch] } as UpstreamResponse)
    expect(() => matchListSchema.parse(out)).not.toThrow()
  })

  it('maps the group match correctly', () => {
    const [m] = transform({ matches: [groupMatch] } as UpstreamResponse)
    expect(m).toEqual({
      id: 'fd-1',
      utcKickoff: '2026-06-11T19:00:00Z',
      status: 'scheduled',
      stage: 'group',
      group: 'A',
      teamA: { iso: 'mx', name: 'Mexico' },
      teamB: { iso: 'ca', name: 'Canada' },
    })
  })

  it('maps the knockout match: no group, includes score', () => {
    const [m] = transform({ matches: [finalMatch] } as UpstreamResponse)
    expect(m?.stage).toBe('final')
    expect(m && 'group' in m).toBe(false)
    expect(m?.score).toEqual({ home: 3, away: 2 })
  })

  it('omits score when fullTime values are null (pre-kickoff)', () => {
    const m = transform({
      matches: [{ ...groupMatch, score: { fullTime: { home: null, away: null } } }],
    } as UpstreamResponse)[0]
    expect(m && 'score' in m).toBe(false)
  })

  it('maps England → gb and Scotland → xs (schema-friendly 2-letter aliases)', () => {
    const out = transform({
      matches: [
        {
          ...groupMatch,
          homeTeam: { id: 10, name: 'England' },
          awayTeam: { id: 11, name: 'Scotland' },
        },
      ],
    } as UpstreamResponse)
    expect(out[0]?.teamA.iso).toBe('gb')
    expect(out[0]?.teamB.iso).toBe('xs')
    // Both aliases must satisfy the client schema (no hyphenated codes).
    expect(() => matchListSchema.parse(out)).not.toThrow()
  })

  it('emits the undetermined sentinel (xx) for a knockout slot with no team', () => {
    const out = transform({
      matches: [
        {
          id: 200,
          utcDate: '2026-07-05T19:00:00Z',
          status: 'SCHEDULED',
          stage: 'QUARTER_FINALS',
          group: null,
          homeTeam: { id: null, name: null },
          awayTeam: { id: 12, name: 'Brazil' },
        },
      ],
    } as UpstreamResponse)
    expect(out[0]?.teamA).toEqual({ iso: 'xx', name: 'Por definir' })
    expect(out[0]?.teamB.iso).toBe('br')
    // A half-undetermined match is still schema-valid.
    expect(() => matchListSchema.parse(out)).not.toThrow()
  })

  it('omits score for a live (in-play) match even when fullTime carries one', () => {
    const m = transform({
      matches: [{ ...groupMatch, status: 'IN_PLAY', score: { fullTime: { home: 1, away: 0 } } }],
    } as UpstreamResponse)[0]
    expect(m?.status).toBe('live')
    expect(m && 'score' in m).toBe(false)
  })
})

describe('transform — real WC-2026 participant names (football-data.org v4)', () => {
  // The EXACT strings football-data.org emits, captured from the live API.
  // If any of these stops mapping, the cron aborts (preserving the base
  // JSON) but the snapshot never refreshes — so lock them here.
  const REAL_NAMES = [
    'Algeria',
    'Argentina',
    'Australia',
    'Austria',
    'Belgium',
    'Bosnia-Herzegovina',
    'Brazil',
    'Canada',
    'Cape Verde Islands',
    'Colombia',
    'Congo DR',
    'Croatia',
    'Curaçao',
    'Czechia',
    'Ecuador',
    'Egypt',
    'England',
    'France',
    'Germany',
    'Ghana',
    'Haiti',
    'Iran',
    'Iraq',
    'Ivory Coast',
    'Japan',
    'Jordan',
    'Mexico',
    'Morocco',
    'Netherlands',
    'New Zealand',
    'Norway',
    'Panama',
    'Paraguay',
    'Portugal',
    'Qatar',
    'Saudi Arabia',
    'Scotland',
    'Senegal',
    'South Africa',
    'South Korea',
    'Spain',
    'Sweden',
    'Switzerland',
    'Tunisia',
    'Turkey',
    'United States',
    'Uruguay',
    'Uzbekistan',
  ]

  it('maps every real participant name to a schema-valid team', () => {
    const out = transform({
      matches: REAL_NAMES.map((name, i) => ({
        id: i,
        utcDate: '2026-06-15T19:00:00Z',
        status: 'SCHEDULED',
        stage: 'GROUP_STAGE',
        group: 'GROUP_A',
        homeTeam: { id: i, name },
        awayTeam: { id: 999, name: 'France' },
      })),
    } as UpstreamResponse)

    expect(out).toHaveLength(REAL_NAMES.length)
    expect(() => matchListSchema.parse(out)).not.toThrow()
  })
})

describe('transform — strict failure (preserves base JSON by aborting)', () => {
  it('throws on an unknown status enum', () => {
    expect(() =>
      transform({ matches: [{ ...groupMatch, status: 'WEIRD' }] } as UpstreamResponse),
    ).toThrow(/unknown upstream status/)
  })

  it('throws on an unknown stage enum', () => {
    expect(() =>
      transform({ matches: [{ ...groupMatch, stage: 'PLAYOFF' }] } as UpstreamResponse),
    ).toThrow(/unknown upstream stage/)
  })

  it('throws on a team name with no ISO mapping', () => {
    expect(() =>
      transform({
        matches: [{ ...groupMatch, homeTeam: { id: 1, name: 'Atlantis' } }],
      } as UpstreamResponse),
    ).toThrow(/no ISO mapping for team "Atlantis"/)
  })
})
