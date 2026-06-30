import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BracketView from '@/app/BracketView.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import {
  __parkMatchesAtIdleForTests,
  __reloadMatchesForTests,
  __resetMatchesForTests,
  __setChooseSourceForTests,
} from '@/matches/composables/useMatches'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'
import { __resetNowForTests } from '@/shared/time/useNow'
import { matchListSchema } from '@/matches/domain/match.schema'
import fixtureJson from '@/shared/fixture/matches.fixture.json'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

const fixture = matchListSchema.parse(fixtureJson)

describe('BracketView', () => {
  beforeEach(() => {
    useI18n().setLocale('es')
    __setClockForTests(() => Date.parse('2026-06-29T18:00:00Z'))
    __resetNowForTests()
  })

  afterEach(() => {
    useI18n().clearOverride()
    __resetMatchesForTests()
    __resetClockForTests()
    __resetNowForTests()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('renders the loading copy while the data layer is idle', () => {
    __parkMatchesAtIdleForTests()

    const wrapper = mount(BracketView)

    expect(wrapper.text()).toContain('Cargando partidos…')
    expect(wrapper.text()).not.toContain('Imprimir cuadro')
  })

  it('renders the bracket and triggers browser print when ready', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    __setChooseSourceForTests(() => Promise.resolve({ matches: fixture, sourceName: 'remote' }))
    await __reloadMatchesForTests()
    await flushPromises()

    const printSpy = vi.fn()
    vi.stubGlobal('print', printSpy)

    const wrapper = mount(BracketView)
    await flushPromises()

    expect(wrapper.text()).toContain('Cuadro final')
    expect(wrapper.text()).toContain('32avos')
    const button = wrapper.get('button')
    expect(button.text()).toBe('Imprimir cuadro')

    await button.trigger('click')
    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('renders the empty state when matches load but no knockout slots exist yet', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    __setChooseSourceForTests(() =>
      Promise.resolve({
        matches: fixture.filter((match) => match.stage === 'group'),
        sourceName: 'remote',
      }),
    )
    await __reloadMatchesForTests()
    await flushPromises()

    const wrapper = mount(BracketView)
    await flushPromises()

    expect(wrapper.text()).toContain('El cuadro todavía no está disponible')
    expect(wrapper.text()).not.toContain('Imprimir cuadro')
  })

  it('renders the degraded ready state with a stale data indicator', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    __setChooseSourceForTests(() => Promise.resolve({ matches: fixture, sourceName: 'manual' }))
    await __reloadMatchesForTests()
    await flushPromises()

    const wrapper = mount(BracketView)
    await flushPromises()

    const dot = wrapper.get('[role="img"]')
    expect(dot.attributes('aria-label')).toBe('Datos de respaldo (sin conexión)')
    expect(wrapper.text()).toContain('Imprimir cuadro')
  })

  it('renders the error state when every source fails', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    __setChooseSourceForTests(() => Promise.resolve(null))
    await __reloadMatchesForTests()
    await flushPromises()

    const wrapper = mount(BracketView)
    await flushPromises()

    expect(wrapper.text()).toContain('No se pudo cargar el cuadro')
    expect(wrapper.text()).not.toContain('Imprimir cuadro')
  })
})
