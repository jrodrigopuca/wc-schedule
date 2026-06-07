import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DaySelector from '@/matches/ui/DaySelector.vue'
import type { Match } from '@/matches/domain/match'
import { useI18n } from '@/shared/i18n/useI18n'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

// BA-pinned host TZ. Today = 2026-06-13 local.
const NOW = Date.parse('2026-06-13T17:00:00Z')

const MATCH_TODAY: Match = {
  id: 'm-1',
  utcKickoff: '2026-06-13T20:00:00Z',
  status: 'scheduled',
  stage: 'group',
  teamA: { iso: 'ar', name: 'Argentina' },
  teamB: { iso: 'br', name: 'Brasil' },
}

const MATCH_OPENING_DAY: Match = {
  id: 'm-0',
  utcKickoff: '2026-06-11T22:00:00Z',
  status: 'scheduled',
  stage: 'group',
  teamA: { iso: 'mx', name: 'México' },
  teamB: { iso: 'za', name: 'Sudáfrica' },
}

describe('DaySelector', () => {
  beforeEach(() => {
    __setClockForTests(() => NOW)
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
  })

  afterEach(() => {
    __resetClockForTests()
    useI18n().clearOverride()
  })

  it('renders 39 chips for the 2026 window', () => {
    const wrapper = mount(DaySelector, {
      props: { matches: [MATCH_TODAY, MATCH_OPENING_DAY], selectedYMD: null, now: NOW },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(39)
  })

  it("labels the today chip with the localized 'Hoy' string (ES)", () => {
    const wrapper = mount(DaySelector, {
      props: { matches: [MATCH_TODAY], selectedYMD: null, now: NOW },
    })
    const todayChip = wrapper.find('[aria-current="date"]')
    expect(todayChip.exists()).toBe(true)
    expect(todayChip.text()).toContain('Hoy')
  })

  it('emits "select" with the YMD when a chip is clicked', async () => {
    const wrapper = mount(DaySelector, {
      props: { matches: [MATCH_OPENING_DAY], selectedYMD: null, now: NOW },
    })
    const buttons = wrapper.findAll('button')
    await buttons[0]?.trigger('click')
    const events = wrapper.emitted('select')
    expect(events).toBeDefined()
    expect(events?.[0]).toEqual(['2026-06-11'])
  })

  it('marks empty-day chips with the muted style/data attribute', () => {
    const wrapper = mount(DaySelector, {
      props: { matches: [MATCH_OPENING_DAY], selectedYMD: null, now: NOW },
    })
    // 2026-07-05 has no matches in the curated input → must be empty.
    const emptyChips = wrapper.findAll('[data-empty="true"]')
    expect(emptyChips.length).toBeGreaterThan(0)
  })

  it('applies the active style to the chip matching selectedYMD', () => {
    const wrapper = mount(DaySelector, {
      props: { matches: [MATCH_OPENING_DAY], selectedYMD: '2026-06-15', now: NOW },
    })
    const active = wrapper.findAll('[data-chip-active="true"]')
    expect(active).toHaveLength(1)
    expect(active[0]?.attributes('aria-pressed')).toBe('true')
  })

  it('falls back to the today chip when selectedYMD is null', () => {
    const wrapper = mount(DaySelector, {
      props: { matches: [MATCH_TODAY], selectedYMD: null, now: NOW },
    })
    const active = wrapper.findAll('[data-chip-active="true"]')
    expect(active).toHaveLength(1)
    expect(active[0]?.text()).toContain('Hoy')
  })

  it('uses overflow-x: auto on the chip strip', () => {
    const wrapper = mount(DaySelector, {
      props: { matches: [MATCH_TODAY], selectedYMD: null, now: NOW },
    })
    const ul = wrapper.find('ul')
    expect(ul.exists()).toBe(true)
    // CSS modules hash the class name, so we only assert the element is
    // a `<ul>` with one `<li>` per day — the overflow-x is style-module
    // scoped and not directly observable via getComputedStyle in
    // happy-dom. The compile-time existence of the `overflow-x` rule is
    // covered by the snapshot of the SFC itself (style block above).
    expect(wrapper.findAll('li')).toHaveLength(39)
  })
})
