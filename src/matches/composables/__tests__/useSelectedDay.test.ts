import { afterEach, beforeEach, describe, expect, it } from 'vitest'

async function loadModule(): Promise<typeof import('@/matches/composables/useSelectedDay')> {
  const vitest = await import('vitest')
  vitest.vi.resetModules()
  return import('@/matches/composables/useSelectedDay')
}

describe('parseSelectedDay', () => {
  it('extracts the YMD for a "#/day/<YMD>" hash', async () => {
    const { parseSelectedDay } = await loadModule()
    expect(parseSelectedDay('#/day/2026-06-12')).toBe('2026-06-12')
  })

  it('returns the raw substring even for malformed YMDs (UI handles it)', async () => {
    const { parseSelectedDay } = await loadModule()
    expect(parseSelectedDay('#/day/2026-13-99')).toBe('2026-13-99')
  })

  it('returns null for the empty hash', async () => {
    const { parseSelectedDay } = await loadModule()
    expect(parseSelectedDay('#')).toBeNull()
    expect(parseSelectedDay('')).toBeNull()
  })

  it('returns null for the preview hash (preview wins)', async () => {
    const { parseSelectedDay } = await loadModule()
    expect(parseSelectedDay('#/preview')).toBeNull()
  })

  it('returns null for any other unknown hash', async () => {
    const { parseSelectedDay } = await loadModule()
    expect(parseSelectedDay('#/something-else')).toBeNull()
  })

  it('trims trailing slash / querystring', async () => {
    const { parseSelectedDay } = await loadModule()
    expect(parseSelectedDay('#/day/2026-06-12/')).toBe('2026-06-12')
    expect(parseSelectedDay('#/day/2026-06-12?foo=bar')).toBe('2026-06-12')
  })
})

describe('useSelectedDay', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('initializes from the current hash at module load', async () => {
    window.location.hash = '#/day/2026-06-12'
    const { useSelectedDay } = await loadModule()
    const { selectedYMD } = useSelectedDay()
    expect(selectedYMD.value).toBe('2026-06-12')
  })

  it('selectDay("YMD") updates the location hash and the ref', async () => {
    const { useSelectedDay } = await loadModule()
    const { selectedYMD, selectDay } = useSelectedDay()
    selectDay('2026-06-15')
    expect(window.location.hash).toBe('#/day/2026-06-15')
    expect(selectedYMD.value).toBe('2026-06-15')
  })

  it('selectDay(null) clears the hash and the ref', async () => {
    window.location.hash = '#/day/2026-06-15'
    const { useSelectedDay } = await loadModule()
    const { selectedYMD, selectDay } = useSelectedDay()
    expect(selectedYMD.value).toBe('2026-06-15')
    selectDay(null)
    expect(window.location.hash === '' || window.location.hash === '#').toBe(true)
    expect(selectedYMD.value).toBeNull()
  })

  it('reacts to a hashchange event', async () => {
    const { useSelectedDay } = await loadModule()
    const { selectedYMD } = useSelectedDay()
    expect(selectedYMD.value).toBeNull()
    window.location.hash = '#/day/2026-07-01'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(selectedYMD.value).toBe('2026-07-01')
    window.location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(selectedYMD.value).toBeNull()
  })
})
