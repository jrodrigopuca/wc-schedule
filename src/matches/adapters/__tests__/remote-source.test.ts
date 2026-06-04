import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRemoteSource } from '@/matches/adapters/remote-source'

const validPayload = [
  {
    id: 'wc2026-001',
    utcKickoff: '2026-06-11T20:00:00Z',
    status: 'scheduled',
    stage: 'group',
    group: 'A',
    teamA: { iso: 'mx', name: 'México' },
    teamB: { iso: 'ar', name: 'Argentina' },
  },
]

function mockFetch(response: {
  ok?: boolean
  status?: number
  json?: () => Promise<unknown>
}): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: response.json ?? (() => Promise.resolve(validPayload)),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createRemoteSource', () => {
  it('exposes name="remote"', () => {
    const source = createRemoteSource('/anywhere')
    expect(source.name).toBe('remote')
  })

  it('returns parsed payload on 200', async () => {
    mockFetch({ ok: true, status: 200 })
    const source = createRemoteSource('/anywhere')
    const result = await source.load()
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('wc2026-001')
  })

  it('throws including the status code on 404', async () => {
    mockFetch({ ok: false, status: 404 })
    const source = createRemoteSource('/anywhere')
    await expect(source.load()).rejects.toThrow(/remote: 404/)
  })

  it('throws on 500', async () => {
    mockFetch({ ok: false, status: 500 })
    const source = createRemoteSource('/anywhere')
    await expect(source.load()).rejects.toThrow(/remote: 500/)
  })

  it('propagates a malformed-JSON failure from response.json()', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    })
    const source = createRemoteSource('/anywhere')
    await expect(source.load()).rejects.toThrow(SyntaxError)
  })

  it('throws when the payload fails schema validation', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            id: 'wc2026-bad',
            // utcKickoff missing on purpose
            status: 'scheduled',
            stage: 'group',
            teamA: { iso: 'mx', name: 'México' },
            teamB: { iso: 'ar', name: 'Argentina' },
          },
        ]),
    })
    const source = createRemoteSource('/anywhere')
    await expect(source.load()).rejects.toThrow()
  })

  it('passes cache: "no-store" to fetch', async () => {
    const fetchFn = mockFetch({ ok: true, status: 200 })
    const source = createRemoteSource('/somewhere/matches.json')
    await source.load()
    expect(fetchFn).toHaveBeenCalledWith('/somewhere/matches.json', {
      cache: 'no-store',
    })
  })

  it('defaults the URL to /wc-schedule/data/matches.json', async () => {
    const fetchFn = mockFetch({ ok: true, status: 200 })
    const source = createRemoteSource()
    await source.load()
    expect(fetchFn).toHaveBeenCalledWith('/wc-schedule/data/matches.json', { cache: 'no-store' })
  })
})
