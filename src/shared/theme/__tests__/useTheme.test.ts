import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '@/shared/theme/storage'

interface MockMediaQueryList {
  matches: boolean
  media: string
  onchange: ((event: MediaQueryListEvent) => void) | null
  addEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void
  removeEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void
  dispatchEvent: (event: Event) => boolean
}

interface MatchMediaStub {
  matchMedia: (query: string) => MockMediaQueryList
  emitChange: (matches: boolean) => void
}

function createMatchMediaStub(initialMatches: boolean): MatchMediaStub {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  let matches = initialMatches

  const mq: MockMediaQueryList = {
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    get matches() {
      return matches
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener)
    },
    dispatchEvent: () => true,
  }

  return {
    matchMedia: () => mq,
    emitChange: (next) => {
      matches = next
      const event = { matches: next, media: mq.media } as MediaQueryListEvent
      listeners.forEach((listener) => {
        listener(event)
      })
    },
  }
}

async function loadUseTheme(): Promise<typeof import('@/shared/theme/useTheme')> {
  vi.resetModules()
  return import('@/shared/theme/useTheme')
}

describe('useTheme composable', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('honors OS dark preference when no override is stored', async () => {
    const stub = createMatchMediaStub(true)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { useTheme } = await loadUseTheme()
    const theme = useTheme()

    expect(theme.current.value).toBe('dark')
  })

  it('writes storage, updates state, and applies data-theme on setTheme', async () => {
    const stub = createMatchMediaStub(false)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { useTheme } = await loadUseTheme()
    const theme = useTheme()

    theme.setTheme('light')

    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(theme.current.value).toBe('light')
  })

  it('lets the stored override win over OS preference on reload', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    const stub = createMatchMediaStub(true)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { useTheme } = await loadUseTheme()
    const theme = useTheme()

    expect(theme.current.value).toBe('light')
  })

  it('clears storage and falls back to OS preference on clearOverride', async () => {
    const stub = createMatchMediaStub(true)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { useTheme } = await loadUseTheme()
    const theme = useTheme()
    theme.setTheme('light')
    expect(theme.current.value).toBe('light')

    theme.clearOverride()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(theme.current.value).toBe('dark')
  })

  it('tracks live OS preference changes only when no override is set', async () => {
    const stub = createMatchMediaStub(false)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { useTheme } = await loadUseTheme()
    const theme = useTheme()
    expect(theme.current.value).toBe('light')

    stub.emitChange(true)
    expect(theme.current.value).toBe('dark')

    theme.setTheme('light')
    stub.emitChange(false)
    stub.emitChange(true)
    expect(theme.current.value).toBe('light')
  })
})
