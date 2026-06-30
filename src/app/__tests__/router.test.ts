import { afterEach, beforeEach, describe, expect, it } from 'vitest'

async function loadRouter(): Promise<typeof import('@/app/router')> {
  // Force a clean singleton each time so module-scoped state is reset
  // between tests (mirrors the useI18n test strategy).
  const vitest = await import('vitest')
  vitest.vi.resetModules()
  return import('@/app/router')
}

describe('parseHash', () => {
  it('returns "main" for empty hash', async () => {
    const { parseHash } = await loadRouter()
    expect(parseHash('')).toBe('main')
  })

  it('returns "main" for "#"', async () => {
    const { parseHash } = await loadRouter()
    expect(parseHash('#')).toBe('main')
  })

  it('returns "preview" for "#/preview"', async () => {
    const { parseHash } = await loadRouter()
    expect(parseHash('#/preview')).toBe('preview')
  })

  it('returns "preview" for "#/preview/"', async () => {
    const { parseHash } = await loadRouter()
    expect(parseHash('#/preview/')).toBe('preview')
  })

  it('returns "preview" for "#/preview?foo=bar"', async () => {
    const { parseHash } = await loadRouter()
    expect(parseHash('#/preview?foo=bar')).toBe('preview')
  })

  it('returns "bracket" for "#/bracket" variants', async () => {
    const { parseHash } = await loadRouter()
    expect(parseHash('#/bracket')).toBe('bracket')
    expect(parseHash('#/bracket/')).toBe('bracket')
    expect(parseHash('#/bracket?print=1')).toBe('bracket')
  })

  it('returns "main" for an unknown hash', async () => {
    const { parseHash } = await loadRouter()
    expect(parseHash('#/something-else')).toBe('main')
  })

  it('returns "main" for "#/day/<YMD>" (day route is owned by useSelectedDay)', async () => {
    const { parseHash } = await loadRouter()
    expect(parseHash('#/day/2026-06-12')).toBe('main')
  })
})

describe('useRoute', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('navigate("preview") updates the location hash', async () => {
    const { useRoute } = await loadRouter()
    const route = useRoute()
    route.navigate('preview')
    expect(window.location.hash).toBe('#/preview')
  })

  it('navigate("bracket") updates the location hash', async () => {
    const { useRoute } = await loadRouter()
    const route = useRoute()
    route.navigate('bracket')
    expect(window.location.hash).toBe('#/bracket')
  })

  it('navigate("main") clears the location hash', async () => {
    window.location.hash = '#/preview'
    const { useRoute } = await loadRouter()
    const route = useRoute()
    route.navigate('main')
    // Some environments return '' once the hash is cleared.
    expect(window.location.hash === '' || window.location.hash === '#').toBe(true)
  })

  it('reacts to the hashchange event by flipping the current ref', async () => {
    const { useRoute } = await loadRouter()
    const route = useRoute()
    expect(route.current.value).toBe('main')
    window.location.hash = '#/preview'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(route.current.value).toBe('preview')
    window.location.hash = '#/bracket'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(route.current.value).toBe('bracket')
    window.location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(route.current.value).toBe('main')
  })

  it('initializes from the current hash at module load', async () => {
    window.location.hash = '#/preview'
    const { useRoute } = await loadRouter()
    const route = useRoute()
    expect(route.current.value).toBe('preview')
  })
})
