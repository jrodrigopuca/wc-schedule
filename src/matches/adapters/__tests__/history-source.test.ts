import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHistorySource } from '@/matches/adapters/history-source'

const BASE = '/wc-schedule/data/history/'

const validSnapshot = [
  {
    id: 'wc2026-h-001',
    utcKickoff: '2026-06-11T20:00:00Z',
    status: 'scheduled',
    stage: 'group',
    group: 'A',
    teamA: { iso: 'mx', name: 'México' },
    teamB: { iso: 'ar', name: 'Argentina' },
  },
]

const validManifest = {
  version: 1,
  entries: [
    { date: '2026-06-15', file: 'matches-2026-06-15.json' },
    { date: '2026-06-14', file: 'matches-2026-06-14.json' },
  ],
}

interface MockResponse {
  ok?: boolean
  status?: number
  json?: () => Promise<unknown>
}

function buildResponse(spec: MockResponse): Response {
  return {
    ok: spec.ok ?? true,
    status: spec.status ?? 200,
    json: spec.json ?? (() => Promise.resolve({})),
  } as unknown as Response
}

function mockSequence(...responses: readonly MockResponse[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn()
  for (const spec of responses) {
    fn.mockResolvedValueOnce(buildResponse(spec))
  }
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createHistorySource', () => {
  it('exposes name="history"', () => {
    const source = createHistorySource(BASE)
    expect(source.name).toBe('history')
  })

  it('throws when the manifest is missing (404)', async () => {
    mockSequence({ ok: false, status: 404 })
    const source = createHistorySource(BASE)
    await expect(source.load()).rejects.toThrow(/history: manifest 404/)
  })

  it('throws when the manifest is structurally invalid (missing version)', async () => {
    mockSequence({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ entries: [] }),
    })
    const source = createHistorySource(BASE)
    await expect(source.load()).rejects.toThrow()
  })

  it('throws when the manifest has unknown keys (strict mode)', async () => {
    mockSequence({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          version: 1,
          entries: [],
          extraField: 'nope',
        }),
    })
    const source = createHistorySource(BASE)
    await expect(source.load()).rejects.toThrow()
  })

  it('throws when the manifest is well-formed but empty', async () => {
    mockSequence({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          version: 1,
          entries: [],
        }),
    })
    const source = createHistorySource(BASE)
    await expect(source.load()).rejects.toThrow(/history: manifest is empty/)
  })

  it('throws when the newest snapshot 404s', async () => {
    mockSequence(
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve(validManifest),
      },
      { ok: false, status: 404 },
    )
    const source = createHistorySource(BASE)
    await expect(source.load()).rejects.toThrow(/history: snapshot 404/)
  })

  it('throws when the snapshot fails schema validation', async () => {
    mockSequence(
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve(validManifest),
      },
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ broken: true }]),
      },
    )
    const source = createHistorySource(BASE)
    await expect(source.load()).rejects.toThrow()
  })

  it('resolves the newest entry from a valid manifest', async () => {
    const fetchFn = mockSequence(
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve(validManifest),
      },
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve(validSnapshot),
      },
    )
    const source = createHistorySource(BASE)
    const result = await source.load()
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('wc2026-h-001')
    // The walker requested the FIRST entry's file (newest-first invariant).
    expect(fetchFn).toHaveBeenNthCalledWith(1, `${BASE}index.json`, {
      cache: 'no-store',
    })
    expect(fetchFn).toHaveBeenNthCalledWith(2, `${BASE}matches-2026-06-15.json`, {
      cache: 'no-store',
    })
  })

  it('preserves lowercase iso codes in the returned payload', async () => {
    mockSequence(
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve(validManifest),
      },
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve(validSnapshot),
      },
    )
    const source = createHistorySource(BASE)
    const result = await source.load()
    expect(result[0]?.teamA.iso).toBe('mx')
    expect(result[0]?.teamB.iso).toBe('ar')
  })

  it('normalizes a baseUrl without trailing slash', async () => {
    const fetchFn = mockSequence(
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve(validManifest),
      },
      {
        ok: true,
        status: 200,
        json: () => Promise.resolve(validSnapshot),
      },
    )
    const source = createHistorySource('/no/slash')
    await source.load()
    expect(fetchFn).toHaveBeenNthCalledWith(1, '/no/slash/index.json', {
      cache: 'no-store',
    })
  })
})
