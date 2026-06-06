import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MatchesList from '@/matches/ui/MatchesList.vue'
import type { Match } from '@/matches/domain/match'
import { useI18n } from '@/shared/i18n/useI18n'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

// 2026-06-13 17:00:00 UTC. With the test host running on the default UTC
// host clock under happy-dom, this falls inside the local day 2026-06-13.
const NOW = Date.parse('2026-06-13T17:00:00Z')

// A future-day match (used to confirm "today" filtering excludes it).
const TOMORROW: Match = {
  id: 'wc2026-tomorrow',
  utcKickoff: '2026-06-14T19:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'A',
  teamA: { iso: 'mx', name: 'México' },
  teamB: { iso: 'jp', name: 'Japón' },
}

// Yesterday — also excluded.
const YESTERDAY: Match = {
  id: 'wc2026-yesterday',
  utcKickoff: '2026-06-12T19:00:00Z',
  status: 'finished',
  stage: 'group',
  group: 'B',
  teamA: { iso: 'ca', name: 'Canadá' },
  teamB: { iso: 'ch', name: 'Suiza' },
}

// Two matches today at distinct kickoffs, plus a tiebreak pair at the same
// instant so the secondary id-asc rule (AC-3) is exercised.
const TODAY_EARLY: Match = {
  id: 'wc2026-today-early',
  utcKickoff: '2026-06-13T19:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'C',
  teamA: { iso: 'ar', name: 'Argentina' },
  teamB: { iso: 'ma', name: 'Marruecos' },
}

const TODAY_TIE_A: Match = {
  id: 'wc2026-today-tie-a',
  utcKickoff: '2026-06-13T22:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'D',
  teamA: { iso: 'br', name: 'Brasil' },
  teamB: { iso: 'cm', name: 'Camerún' },
}

const TODAY_TIE_B: Match = {
  id: 'wc2026-today-tie-b',
  utcKickoff: '2026-06-13T22:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'E',
  teamA: { iso: 'de', name: 'Alemania' },
  teamB: { iso: 'es', name: 'España' },
}

const TODAY_CANCELLED: Match = {
  id: 'wc2026-today-cancelled',
  utcKickoff: '2026-06-13T15:00:00Z',
  status: 'cancelled',
  stage: 'group',
  group: 'F',
  teamA: { iso: 'fr', name: 'Francia' },
  teamB: { iso: 'pt', name: 'Portugal' },
}

describe('MatchesList', () => {
  beforeEach(() => {
    __setClockForTests(() => NOW)
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
  })

  afterEach(() => {
    __resetClockForTests()
    useI18n().clearOverride()
  })

  it("renders only today's matches and excludes yesterday/tomorrow (AC-7)", () => {
    const wrapper = mount(MatchesList, {
      props: { matches: [TOMORROW, TODAY_EARLY, YESTERDAY], now: NOW },
    })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(1)
    expect(wrapper.text()).toContain('Argentina')
    expect(wrapper.text()).toContain('Marruecos')
    expect(wrapper.text()).not.toContain('México')
    expect(wrapper.text()).not.toContain('Canadá')
  })

  it('excludes cancelled matches (AC-6)', () => {
    const wrapper = mount(MatchesList, {
      props: { matches: [TODAY_EARLY, TODAY_CANCELLED], now: NOW },
    })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Francia')
  })

  it('sorts ascending by kickoff, breaking ties by id (AC-3)', () => {
    const wrapper = mount(MatchesList, {
      props: { matches: [TODAY_TIE_B, TODAY_EARLY, TODAY_TIE_A], now: NOW },
    })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(3)
    // Order: 19:00 (TODAY_EARLY), then 22:00 tie-a (lower id), then 22:00 tie-b.
    const labels = items.map((li) => li.attributes('aria-label') ?? '')
    expect(labels[0]).toContain('Argentina')
    expect(labels[1]).toContain('Brasil')
    expect(labels[2]).toContain('Alemania')
  })

  it('renders the empty-state surface when nothing matches today (AC-8)', () => {
    const wrapper = mount(MatchesList, {
      props: { matches: [YESTERDAY, TOMORROW], now: NOW },
    })
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.text()).toContain('No hay partidos hoy')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('renders the count badge reflecting the post-filter length', () => {
    const wrapper = mount(MatchesList, {
      props: { matches: [TODAY_EARLY, TODAY_TIE_A, TODAY_CANCELLED, TOMORROW], now: NOW },
    })
    expect(wrapper.text()).toContain('2 partidos')
  })
})
