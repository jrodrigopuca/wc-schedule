import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '@/app/MainView.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import {
  __parkMatchesAtIdleForTests,
  __reloadMatchesForTests,
  __resetMatchesForTests,
} from '@/matches/composables/useMatches'

describe('MainView (smoke)', () => {
  beforeEach(() => {
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
  })

  afterEach(() => {
    useI18n().clearOverride()
    vi.unstubAllEnvs()
    __resetMatchesForTests()
  })

  it('renders the loading copy when status is idle (pre-load)', () => {
    __parkMatchesAtIdleForTests()
    const wrapper = mount(MainView)
    expect(wrapper.text()).toContain('Cargando partidos…')
  })

  it('renders the FeaturedCard + MatchesList once the load resolves', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    await __reloadMatchesForTests()
    await flushPromises()
    const wrapper = mount(MainView)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Cargando partidos…')
    const text = wrapper.text()
    const hasEyebrow =
      text.includes('En vivo') || text.includes('Próximo partido') || text.includes('Mundial 2026')
    expect(hasEyebrow).toBe(true)
    // Manual mode → no stale indicator.
    expect(text).not.toContain('Mostrando datos de respaldo')
    expect(text).not.toContain('Mostrando datos guardados')
  })

  it('renders the stale-fixture indicator in degraded mode (remote → fixture fallback)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    await __reloadMatchesForTests()
    await flushPromises()
    const wrapper = mount(MainView)
    await flushPromises()
    expect(wrapper.text()).toContain('Mostrando datos de respaldo')
  })

  it('renders the open-gallery footer link', () => {
    const wrapper = mount(MainView)
    expect(wrapper.text()).toContain('Galería de componentes')
  })
})
