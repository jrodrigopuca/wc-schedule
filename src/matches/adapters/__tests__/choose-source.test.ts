import { describe, expect, it, vi } from 'vitest'
import { chooseSource } from '@/matches/adapters/choose-source'
import type { Match } from '@/matches/domain/match'
import type { MatchSource } from '@/matches/ports/match-source'

const matchA: Match = {
  id: 'a',
  utcKickoff: '2026-06-11T20:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'A',
  teamA: { iso: 'mx', name: 'México' },
  teamB: { iso: 'ar', name: 'Argentina' },
}

const matchB: Match = {
  id: 'b',
  utcKickoff: '2026-06-12T19:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'B',
  teamA: { iso: 'br', name: 'Brasil' },
  teamB: { iso: 'fr', name: 'Francia' },
}

const matchC: Match = {
  id: 'c',
  utcKickoff: '2026-06-13T22:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'C',
  teamA: { iso: 'us', name: 'Estados Unidos' },
  teamB: { iso: 'ca', name: 'Canadá' },
}

function stub(name: string, behavior: () => Promise<readonly Match[]>): MatchSource {
  return { name, load: behavior }
}

describe('chooseSource', () => {
  it('returns the first source payload and does not consult the rest', async () => {
    const firstLoad = vi.fn().mockResolvedValue([matchA])
    const secondLoad = vi.fn().mockResolvedValue([matchB])
    const thirdLoad = vi.fn().mockResolvedValue([matchC])

    const sources: readonly MatchSource[] = [
      { name: 'remote', load: firstLoad },
      { name: 'history', load: secondLoad },
      { name: 'manual', load: thirdLoad },
    ]

    const result = await chooseSource(sources)

    expect(result).toEqual({ matches: [matchA], sourceName: 'remote' })
    expect(firstLoad).toHaveBeenCalledTimes(1)
    expect(secondLoad).not.toHaveBeenCalled()
    expect(thirdLoad).not.toHaveBeenCalled()
  })

  it('skips a throwing source and falls through to the next', async () => {
    const firstLoad = vi.fn().mockRejectedValue(new Error('remote: 500'))
    const secondLoad = vi.fn().mockResolvedValue([matchB])
    const thirdLoad = vi.fn().mockResolvedValue([matchC])

    const sources: readonly MatchSource[] = [
      { name: 'remote', load: firstLoad },
      { name: 'history', load: secondLoad },
      { name: 'manual', load: thirdLoad },
    ]

    const result = await chooseSource(sources)

    expect(result).toEqual({ matches: [matchB], sourceName: 'history' })
    expect(firstLoad).toHaveBeenCalledTimes(1)
    expect(secondLoad).toHaveBeenCalledTimes(1)
    expect(thirdLoad).not.toHaveBeenCalled()
  })

  it('returns null when every source throws', async () => {
    const sources: readonly MatchSource[] = [
      stub('remote', () => Promise.reject(new Error('remote: down'))),
      stub('history', () => Promise.reject(new Error('history: missing'))),
      stub('manual', () => Promise.reject(new Error('manual: corrupt'))),
    ]

    const result = await chooseSource(sources)

    expect(result).toBeNull()
  })

  it('returns null when the source list is empty', async () => {
    const result = await chooseSource([])
    expect(result).toBeNull()
  })

  it('reports the winning sourceName when a later source wins', async () => {
    const sources: readonly MatchSource[] = [
      stub('remote', () => Promise.reject(new Error('boom'))),
      stub('history', () => Promise.reject(new Error('boom'))),
      stub('manual', () => Promise.resolve([matchC])),
    ]

    const result = await chooseSource(sources)

    expect(result?.sourceName).toBe('manual')
    expect(result?.matches).toEqual([matchC])
  })
})
