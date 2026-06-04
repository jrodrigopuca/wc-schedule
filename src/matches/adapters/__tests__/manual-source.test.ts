import { afterEach, describe, expect, it, vi } from 'vitest'
import fixtureJson from '@/shared/fixture/matches.fixture.json'
import { createManualSource } from '@/matches/adapters/manual-source'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createManualSource', () => {
  it('exposes name="manual"', () => {
    const source = createManualSource()
    expect(source.name).toBe('manual')
  })

  it('resolves with the bundled fixture payload', async () => {
    const source = createManualSource()
    const result = await source.load()
    expect(result).toHaveLength(fixtureJson.length)
  })

  it('does NOT call fetch (zero network I/O)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const source = createManualSource()
    await source.load()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
