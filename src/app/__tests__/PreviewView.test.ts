import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PreviewView from '@/app/PreviewView.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

const NOW = Date.parse('2026-06-13T17:00:00Z')

describe('PreviewView (smoke)', () => {
  beforeEach(() => {
    __setClockForTests(() => NOW)
    // Pin to ES — the assertions below are written in Spanish.
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
  })

  afterEach(() => {
    __resetClockForTests()
    useI18n().clearOverride()
  })

  it('renders the page title and intro', () => {
    const wrapper = mount(PreviewView)
    expect(wrapper.text()).toContain('Galería de componentes')
    expect(wrapper.text()).toContain(
      'Vista de todos los estados de los componentes en un solo lugar.',
    )
  })

  it('renders every featured section description (5 variants)', () => {
    const wrapper = mount(PreviewView)
    const text = wrapper.text()
    expect(text).toContain('Próximo partido del día') // upcoming-today
    expect(text).toContain('Un partido se está jugando') // live-single
    expect(text).toContain('Varios partidos en simultáneo') // live-multiple
    expect(text).toContain('Próximo partido en otro día') // upcoming-future
    expect(text).toContain('El Mundial terminó') // tournament-over
  })

  it('renders the back-to-main footer link', () => {
    const wrapper = mount(PreviewView)
    expect(wrapper.text()).toContain('Volver al inicio')
  })
})
