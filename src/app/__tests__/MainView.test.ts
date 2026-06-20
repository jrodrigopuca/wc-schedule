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
import {
  __resetNotificationsForTests,
  __resetNotifierForTests,
} from '@/notifications/composables/useNotifications'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'
import { __resetNowForTests } from '@/shared/time/useNow'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

// Mock the notifier picker so the MainView watcher's call lands on a
// spy notifier (no real timers armed). The mock module also exposes
// `__stubs` so the test can re-import and inspect calls — `vi.mock` is
// hoisted, so we can't close over outer variables in the factory.
//
// Phase 9b: the picker module now also exports `isShowTriggerSupported`,
// consumed by `useNotifications.readInitialState`. We default it to
// `true` so the composable mirrors `Notification.permission` instead of
// pinning to `'unsupported'` — the existing MainView tests assume the
// "supported" path.
vi.mock('@/notifications/adapters/pick-notifier', () => {
  const schedule = vi.fn()
  const cancel = vi.fn()
  const cancelAll = vi.fn()
  const isShowTriggerSupported = vi.fn(() => true)
  return {
    isShowTriggerSupported,
    pickNotifier: vi.fn(() => ({
      name: 'mock',
      schedule,
      cancel,
      cancelAll,
    })),
    __stubs: { schedule, cancel, cancelAll, isShowTriggerSupported },
  }
})

async function loadNotifierStubs(): Promise<{
  schedule: ReturnType<typeof vi.fn>
  cancelAll: ReturnType<typeof vi.fn>
}> {
  const mocked = (await import('@/notifications/adapters/pick-notifier')) as unknown as {
    __stubs: { schedule: ReturnType<typeof vi.fn>; cancelAll: ReturnType<typeof vi.fn> }
  }
  return mocked.__stubs
}

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
    // Re-seed `useNow`'s singleton from the restored real clock so a stubbed
    // `now` from one test never leaks into the next.
    __resetNowForTests()
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
    // Manual mode in dev defaults: still 'ready', dot is "fresh" via the
    // status indicator's aria-label.
    const dot = wrapper.find('[role="img"]')
    expect(dot.exists()).toBe(true)
    expect(dot.attributes('aria-label')).toBe('Datos en línea')
  })

  it('renders a stale data indicator in degraded mode (remote → fixture fallback)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    await __reloadMatchesForTests()
    await flushPromises()
    const wrapper = mount(MainView)
    await flushPromises()
    const dot = wrapper.find('[role="img"]')
    expect(dot.exists()).toBe(true)
    expect(dot.attributes('aria-label')).toBe('Datos de respaldo (sin conexión)')
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

  it('schedules notifications when permission flips to granted', async () => {
    // The watcher in MainView calls `planSchedule(matches, now())` and
    // forwards to `useNotifications().schedule()`, which delegates to
    // the picked notifier. We've mocked the picker module at the file
    // top so we can assert delegation without arming real timers.
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    // Pin to before the tournament so all matches are 'scheduled' and
    // their fireAtMs is in the future — planSchedule returns a non-empty
    // array. Without this, NOW after the tournament would filter all out.
    __setClockForTests(() => Date.parse('2026-06-10T17:00:00Z'))
    // Stub Notification BEFORE mounting so useNotifications reads
    // 'granted' as its initial state. The composable is a singleton —
    // we have to reset it to pick up the new global.
    vi.stubGlobal('Notification', {
      permission: 'granted',
      requestPermission: () => Promise.resolve('granted'),
    })
    __resetNotificationsForTests()
    __resetNotifierForTests()
    const stubs = await loadNotifierStubs()
    stubs.schedule.mockClear()

    await __reloadMatchesForTests()
    await flushPromises()
    mount(MainView)
    await flushPromises()

    // Watcher with `immediate: true` fires on mount with permission ===
    // 'granted'; the composable forwards to the mocked notifier.
    expect(stubs.schedule).toHaveBeenCalled()
    const calls = stubs.schedule.mock.calls
    const lastCall = calls[calls.length - 1] as [readonly unknown[]] | undefined
    expect(Array.isArray(lastCall?.[0])).toBe(true)
    // The fixture has matches — planSchedule should yield at least one
    // entry given our pinned-pre-tournament `now`.
    expect((lastCall?.[0] as readonly unknown[]).length).toBeGreaterThan(0)

    vi.unstubAllGlobals()
    __resetNotificationsForTests()
    __resetNotifierForTests()
  })

  it('hides the FeaturedCard in day mode (#/day/<future-day>)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    __setClockForTests(() => Date.parse('2026-06-13T17:00:00Z'))
    // `useNow`'s singleton `now` ref is seeded at module load with the REAL
    // clock, so it must be re-read AFTER the stub is installed — otherwise
    // `todayYMD` tracks the real calendar date and the day-mode comparison is
    // non-deterministic (this test broke when the real date hit 2026-06-20,
    // colliding with the hash below).
    __resetNowForTests()
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
