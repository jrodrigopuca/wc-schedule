import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '@/app/MainView.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import {
  __parkMatchesAtIdleForTests,
  __reloadMatchesForTests,
  __resetMatchesForTests,
} from '@/matches/composables/useMatches'
import { __resetSelectedDayForTests } from '@/matches/composables/useSelectedDay'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

describe('MainView (smoke)', () => {
  beforeEach(() => {
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
    window.location.hash = ''
    __resetSelectedDayForTests()
  })

  afterEach(() => {
    useI18n().clearOverride()
    vi.unstubAllEnvs()
    __resetMatchesForTests()
    __resetClockForTests()
    window.location.hash = ''
    __resetSelectedDayForTests()
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

  it('always renders the DaySelector strip (39 chips)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    await __reloadMatchesForTests()
    await flushPromises()
    const wrapper = mount(MainView)
    await flushPromises()
    const nav = wrapper.find('nav')
    expect(nav.exists()).toBe(true)
    expect(nav.findAll('button')).toHaveLength(39)
  })

  it('shows the FeaturedCard in main mode (empty hash)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    // Pin to a date inside the tournament window so the featured selector
    // resolves to an upcoming-* state with visible eyebrow copy.
    __setClockForTests(() => Date.parse('2026-06-13T17:00:00Z'))
    await __reloadMatchesForTests()
    await flushPromises()
    const wrapper = mount(MainView)
    await flushPromises()
    // The featured eyebrow is the surface that disambiguates main mode
    // from day mode (no eyebrow in day mode because there's no card).
    expect(wrapper.text()).toContain('Próximo partido')
  })

  it('hides the FeaturedCard in day mode (#/day/<future-day>)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    __setClockForTests(() => Date.parse('2026-06-13T17:00:00Z'))
    // Pin to a future tournament day — the featured eyebrow must NOT
    // appear when the day-mode branch is rendered.
    window.location.hash = '#/day/2026-06-20'
    __resetSelectedDayForTests()
    await __reloadMatchesForTests()
    await flushPromises()
    const wrapper = mount(MainView)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Próximo partido')
    // Day-mode title shows "Día N · <date>".
    expect(wrapper.text()).toMatch(/Día\s+\d+\s+·/)
  })
})
