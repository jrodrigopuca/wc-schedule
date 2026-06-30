import { describe, expect, it } from 'vitest'
import { buildBracketModel } from '@/bracket/domain/buildBracketModel'
import { BRACKET_ROUND_ORDER } from '@/bracket/domain/bracket'
import type { Match } from '@/matches/domain/match'
import { matchListSchema } from '@/matches/domain/match.schema'
import fixtureJson from '@/shared/fixture/matches.fixture.json'

const fixture = matchListSchema.parse(fixtureJson)

describe('buildBracketModel', () => {
  it('returns the fixed 2026 topology in bracket order', () => {
    const groupOnlyMatches = fixture.filter((match) => match.stage === 'group')

    const model = buildBracketModel(groupOnlyMatches)

    expect(model.rounds.map((round) => round.stage)).toEqual(BRACKET_ROUND_ORDER)
    expect(model.rounds.map((round) => round.matches.length)).toEqual([16, 8, 4, 2, 1, 1])
    expect(
      model.rounds.flatMap((round) => round.matches).every((match) => match.match === null),
    ).toBe(true)
  })

  it('filters group matches and maps knockout fixtures into their bracket slots', () => {
    const model = buildBracketModel(fixture)

    expect(
      model.rounds.flatMap((round) => round.matches).filter((match) => match.match !== null),
    ).toHaveLength(32)

    const roundOf32 = model.rounds[0]
    const final = model.rounds[5]

    expect(roundOf32?.matches[0]?.match?.id).toBe('wc2026-r32-01')
    expect(roundOf32?.matches[15]?.match?.id).toBe('wc2026-r32-16')
    expect(final?.matches[0]?.match?.id).toBe('wc2026-final')
    expect(
      model.rounds
        .flatMap((round) => round.matches)
        .every((match) => match.match?.stage !== 'group'),
    ).toBe(true)
  })

  it('maps knockout matches by stage kickoff order instead of requiring fixture ids', () => {
    let knockoutOrdinal = 0
    const remoteLikeFixture = fixture.map((match): Match => {
      if (match.stage === 'group') return match
      knockoutOrdinal += 1
      return { ...match, id: `fd-${537000 + knockoutOrdinal}` }
    })

    const model = buildBracketModel(remoteLikeFixture)

    expect(model.rounds[0]?.matches[0]?.match?.id).toBe('fd-537001')
    expect(model.rounds[0]?.matches[15]?.match?.id).toBe('fd-537016')
    expect(model.rounds[5]?.matches[0]?.match?.id).toBe('fd-537032')
    expect(
      model.rounds.flatMap((round) => round.matches).filter((match) => match.match !== null),
    ).toHaveLength(32)
  })

  it('wires winner and loser lineage through the fixed topology, including third place', () => {
    const model = buildBracketModel(fixture)

    expect(findMatch(model, 'wc2026-r16-01')).toMatchObject({
      sourceA: { kind: 'winner', matchId: 'wc2026-r32-01' },
      sourceB: { kind: 'winner', matchId: 'wc2026-r32-04' },
    })

    expect(findMatch(model, 'wc2026-qf-02')).toMatchObject({
      sourceA: { kind: 'winner', matchId: 'wc2026-r16-05' },
      sourceB: { kind: 'winner', matchId: 'wc2026-r16-06' },
    })

    expect(findMatch(model, 'wc2026-sf-02')).toMatchObject({
      sourceA: { kind: 'winner', matchId: 'wc2026-qf-03' },
      sourceB: { kind: 'winner', matchId: 'wc2026-qf-04' },
    })

    expect(findMatch(model, 'wc2026-3rd')).toMatchObject({
      sourceA: { kind: 'loser', matchId: 'wc2026-sf-01' },
      sourceB: { kind: 'loser', matchId: 'wc2026-sf-02' },
    })

    expect(findMatch(model, 'wc2026-final')).toMatchObject({
      sourceA: { kind: 'winner', matchId: 'wc2026-sf-01' },
      sourceB: { kind: 'winner', matchId: 'wc2026-sf-02' },
    })
  })

  it('keeps final and third-place matches as separate terminal rounds', () => {
    const model = buildBracketModel(fixture)

    expect(model.rounds.map((round) => round.stage)).toEqual(BRACKET_ROUND_ORDER)
    expect(model.rounds[4]?.matches.map((match) => match.id)).toEqual(['wc2026-3rd'])
    expect(model.rounds[5]?.matches.map((match) => match.id)).toEqual(['wc2026-final'])
    expect(model.rounds[4]?.matches[0]).toMatchObject({
      sourceA: { kind: 'loser', matchId: 'wc2026-sf-01' },
      sourceB: { kind: 'loser', matchId: 'wc2026-sf-02' },
    })
    expect(model.rounds[5]?.matches[0]).toMatchObject({
      sourceA: { kind: 'winner', matchId: 'wc2026-sf-01' },
      sourceB: { kind: 'winner', matchId: 'wc2026-sf-02' },
    })
  })
})

function findMatch(model: ReturnType<typeof buildBracketModel>, id: string) {
  const match = model.rounds
    .flatMap((round) => round.matches)
    .find((roundMatch) => roundMatch.id === id)
  expect(match, `missing bracket match ${id}`).toBeDefined()
  return match as NonNullable<typeof match>
}
