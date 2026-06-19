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

  it('omits score for a live (in-play) match even when fullTime carries one', () => {
    const m = transform({
      matches: [{ ...groupMatch, status: 'IN_PLAY', score: { fullTime: { home: 1, away: 0 } } }],
    } as UpstreamResponse)[0]
    expect(m?.status).toBe('live')
    expect(m && 'score' in m).toBe(false)
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
