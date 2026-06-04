import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '@/app/MainView.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import {
  __parkMatchesAtIdleForTests,
  __reloadMatchesForTests,
} from '@/matches/composables/useMatches'

describe('MainView (smoke)', () => {
  beforeEach(() => {
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
  })

  afterEach(() => {
    useI18n().clearOverride()
  })

  it('renders the loading copy when status is idle (pre-load)', () => {
    // Park the singleton at 'idle' BEFORE mounting — earlier tests in the
    // run may have driven it to 'ready', so we need an explicit reset to
    // assert the pre-load surface. The MainView template renders the same
    // 'message' branch for both 'idle' and 'loading'.
    __parkMatchesAtIdleForTests()
    const wrapper = mount(MainView)
    expect(wrapper.text()).toContain('Cargando partidos…')
  })

  it('renders the FeaturedCard once the matches load resolves', async () => {
    await __reloadMatchesForTests()
    await flushPromises()
    const wrapper = mount(MainView)
    await flushPromises()
    // The loading copy is gone; either a derby tableau, the live text, the
    // multi-live headline, or the tournament-over headline is on screen.
    // Smoke-checking that the loading copy is NOT in the DOM is sufficient
    // for this gate — the per-variant assertions live in FeaturedCard.test.ts.
    expect(wrapper.text()).not.toContain('Cargando partidos…')
    // The eyebrow label is always rendered by FeaturedCard. ES copy paths:
    // 'En vivo' | 'Próximo partido' | 'Mundial 2026'.
    const text = wrapper.text()
    const hasEyebrow =
      text.includes('En vivo') || text.includes('Próximo partido') || text.includes('Mundial 2026')
    expect(hasEyebrow).toBe(true)
  })

  it('renders the open-gallery footer link', () => {
    const wrapper = mount(MainView)
    expect(wrapper.text()).toContain('Galería de componentes')
  })
})
