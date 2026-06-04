import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { STORAGE_KEY } from '@/shared/i18n/storage'

function stubNavigator(language: string, languages: readonly string[] = [language]): void {
  vi.stubGlobal('navigator', { language, languages })
}

async function mountLocaleToggle(): Promise<ReturnType<typeof mount>> {
  vi.resetModules()
  const mod = await import('@/shared/ui/LocaleToggle.vue')
  return mount(mod.default)
}

describe('LocaleToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders both segments and highlights the active locale', async () => {
    stubNavigator('es-AR')
    const wrapper = await mountLocaleToggle()

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.text()).toBe('ES')
    expect(buttons[1]!.text()).toBe('EN')
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('false')
  })

  it('switches to "en" when EN segment is clicked, and persists it', async () => {
    stubNavigator('es-AR')
    const wrapper = await mountLocaleToggle()

    const buttons = wrapper.findAll('button')
    await buttons[1]!.trigger('click')

    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')
    expect(buttons[0]!.attributes('aria-pressed')).toBe('false')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('true')
  })

  it('switches to "es" when ES segment is clicked, and persists it', async () => {
    stubNavigator('en-US')
    const wrapper = await mountLocaleToggle()

    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')

    expect(localStorage.getItem(STORAGE_KEY)).toBe('es')
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
  })

  it('honors a stored override on mount', async () => {
    stubNavigator('es-AR')
    localStorage.setItem(STORAGE_KEY, 'en')

    const wrapper = await mountLocaleToggle()
    const buttons = wrapper.findAll('button')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('true')
  })

  it('exposes a localized group aria-label that targets the next switch', async () => {
    stubNavigator('es-AR')
    const wrapper = await mountLocaleToggle()
    const group = wrapper.find('[role="group"]')
    expect(group.attributes('aria-label')).toBe('Cambiar a inglés')
  })
})
