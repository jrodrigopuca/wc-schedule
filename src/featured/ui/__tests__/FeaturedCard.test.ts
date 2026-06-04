import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'
import type { FeaturedState } from '@/featured/domain/featured-state'
import type { Match } from '@/matches/domain/match'
import FeaturedCard from '@/featured/ui/FeaturedCard.vue'
import { useI18n } from '@/shared/i18n/useI18n'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

const NOW = Date.parse('2026-06-13T17:00:00Z')

const sampleMatch: Match = {
  id: 'wc2026-g-c-01',
  utcKickoff: '2026-06-13T19:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'C',
  teamA: { iso: 'ar', name: 'Argentina' },
  teamB: { iso: 'ma', name: 'Marruecos' },
  venue: { city: 'New Jersey', country: 'Estados Unidos' },
}

const futureMatch: Match = {
  ...sampleMatch,
  id: 'wc2026-g-d-01',
  utcKickoff: '2026-06-18T22:00:00Z',
  teamA: { iso: 'br', name: 'Brasil' },
  teamB: { iso: 'jp', name: 'Japón' },
  venue: { city: 'Miami', country: 'Estados Unidos' },
}

describe('FeaturedCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __setClockForTests(() => NOW)
    // Force ES locale regardless of host navigator — copy assertions below
    // are written in Spanish.
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetClockForTests()
    useI18n().clearOverride()
    document.documentElement.removeAttribute('data-theme')
  })

  it('live-single — renders derby tableau, live eyebrow, "Se está jugando ahora" text, no score, no countdown, no CTA', () => {
    const state: FeaturedState = {
      kind: 'live-single',
      match: { ...sampleMatch, status: 'live', score: { home: 2, away: 1 } },
    }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    expect(wrapper.text()).toContain('En vivo')
    expect(wrapper.text()).toContain('Argentina')
    expect(wrapper.text()).toContain('Marruecos')
    expect(wrapper.text()).toContain('VS')
    expect(wrapper.text()).toContain('Se está jugando ahora')
    // Score must NOT leak into the live-single variant — see specs/featured.md
    // and specs/matches.md updates from the i18n-and-live-text-cleanup change.
    expect(wrapper.text()).not.toContain('Marcador')
    expect(wrapper.text()).not.toContain('Avisame')
    expect(wrapper.text()).not.toContain('Falta')
  })

  it('live-multiple — no derby, no countdown, no CTA; shows summary headline', () => {
    const state: FeaturedState = {
      kind: 'live-multiple',
      count: 3,
      matches: [sampleMatch, futureMatch, sampleMatch],
    }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    expect(wrapper.text()).toContain('Hay 3 partidos en vivo')
    expect(wrapper.text()).toContain('Mirá la lista abajo')
    expect(wrapper.text()).not.toContain('VS')
    expect(wrapper.text()).not.toContain('Avisame')
  })

  it('upcoming-today — renders derby, countdown, meta, CTA', () => {
    const state: FeaturedState = {
      kind: 'upcoming-today',
      match: sampleMatch,
      msUntilKickoff: Date.parse(sampleMatch.utcKickoff) - NOW,
    }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    expect(wrapper.text()).toContain('Próximo partido')
    expect(wrapper.text()).toContain('Argentina')
    expect(wrapper.text()).toContain('Marruecos')
    expect(wrapper.text()).toContain('VS')
    expect(wrapper.text()).toContain('Grupo C')
    expect(wrapper.text()).toContain('Avisame 15 min antes')
  })

  it('upcoming-future — prepends a relative date in meta', () => {
    const state: FeaturedState = {
      kind: 'upcoming-future',
      match: futureMatch,
      msUntilKickoff: Date.parse(futureMatch.utcKickoff) - NOW,
    }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    expect(wrapper.text()).toContain('Próximo partido')
    expect(wrapper.text()).toContain('Brasil')
    expect(wrapper.text()).toContain('Japón')
    // formatRelativeDay for a >2-day offset returns a `weekday day month` string.
    // Just verify the time part exists.
    expect(wrapper.text()).toMatch(/\d{2}:\d{2} hora local/)
  })

  it('tournament-over — terminal message, no derby, no countdown, no CTA', () => {
    const state: FeaturedState = { kind: 'tournament-over' }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    expect(wrapper.text()).toContain('El Mundial 2026 ha terminado')
    expect(wrapper.text()).not.toContain('VS')
    expect(wrapper.text()).not.toContain('Avisame')
  })

  it('sets --team-a-glow and --team-b-glow CSS custom properties on the root for derby states', () => {
    const state: FeaturedState = {
      kind: 'upcoming-today',
      match: sampleMatch,
      msUntilKickoff: 0,
    }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    const styleAttr = wrapper.find('section').attributes('style') ?? ''
    expect(styleAttr).toContain('--team-a-glow')
    expect(styleAttr).toContain('--team-b-glow')
  })

  it('emits cta-click when the CTA button is pressed (non-terminal variant)', async () => {
    const state: FeaturedState = {
      kind: 'upcoming-today',
      match: sampleMatch,
      msUntilKickoff: 0,
    }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('cta-click')).toHaveLength(1)
  })

  it('renders without errors when mounted under data-theme="dark"', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const state: FeaturedState = {
      kind: 'upcoming-today',
      match: sampleMatch,
      msUntilKickoff: 0,
    }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    expect(wrapper.find('section').exists()).toBe(true)
    const styleAttr = wrapper.find('section').attributes('style') ?? ''
    expect(styleAttr).toContain('--team-a-glow')
  })

  it('live-multiple keeps the slot coherent without derby tableau (AC-14)', () => {
    const state: FeaturedState = {
      kind: 'live-multiple',
      count: 2,
      matches: [sampleMatch, futureMatch],
    }
    const wrapper = mount(FeaturedCard, { props: { state, now: NOW } })
    expect(wrapper.find('section').attributes('data-variant')).toBe('live-multiple')
    // The featured surface still wraps the content.
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.findAll('img')).toHaveLength(0)
  })
})
