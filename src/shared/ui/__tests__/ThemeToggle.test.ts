import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { STORAGE_KEY } from '@/shared/theme/storage'

interface MockMediaQueryList {
  matches: boolean
  media: string
  onchange: ((event: MediaQueryListEvent) => void) | null
  addEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void
  removeEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void
  dispatchEvent: (event: Event) => boolean
}

function stubMatchMedia(initialMatches: boolean): void {
  const mq: MockMediaQueryList = {
    media: '(prefers-color-scheme: dark)',
    matches: initialMatches,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  }
  vi.stubGlobal('matchMedia', () => mq)
}

async function mountThemeToggle(): Promise<ReturnType<typeof mount>> {
  vi.resetModules()
  const mod = await import('@/shared/ui/ThemeToggle.vue')
  return mount(mod.default)
}

describe('ThemeToggle', () => {
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

  it('flips light → dark on click and updates <html data-theme>', async () => {
    stubMatchMedia(false)
    const wrapper = await mountThemeToggle()

    expect(wrapper.attributes('aria-label')).toBe('Cambiar a modo oscuro')

    await wrapper.trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    expect(wrapper.attributes('aria-label')).toBe('Cambiar a modo claro')
  })

  it('flips dark → light on click and updates <html data-theme>', async () => {
    stubMatchMedia(true)
    const wrapper = await mountThemeToggle()

    expect(wrapper.attributes('aria-label')).toBe('Cambiar a modo claro')

    await wrapper.trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    expect(wrapper.attributes('aria-label')).toBe('Cambiar a modo oscuro')
  })
})
