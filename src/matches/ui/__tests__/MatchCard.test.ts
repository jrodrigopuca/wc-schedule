import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Match } from '@/matches/domain/match'
import MatchCard from '@/matches/ui/MatchCard.vue'
import { useI18n } from '@/shared/i18n/useI18n'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => {
    if (iso === 'zz') return null
    return `/flags/${iso}.svg`
  },
}))

const NOW = Date.parse('2026-06-14T12:00:00Z')

const baseMatch: Match = {
  id: 'wc2026-g-c-01',
  utcKickoff: '2026-06-14T19:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'C',
  teamA: { iso: 'mx', name: 'México' },
  teamB: { iso: 'jp', name: 'Japón' },
  venue: { city: 'Los Ángeles', country: 'Estados Unidos' },
}

describe('MatchCard', () => {
  beforeEach(() => {
    // Pin to Spanish — copy assertions in this file are written in ES.
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
  })

  afterEach(() => {
    useI18n().clearOverride()
  })

  it('renders a scheduled match with the "Programado" badge', () => {
    const wrapper = mount(MatchCard, { props: { match: baseMatch, now: NOW } })
    expect(wrapper.text()).toContain('Programado')
    expect(wrapper.text()).not.toContain('En vivo')
    expect(wrapper.text()).not.toContain('Final')
  })

  it('renders a live match with the "En vivo" badge and does NOT render its score', () => {
    const liveMatch: Match = { ...baseMatch, status: 'live', score: { home: 4, away: 2 } }
    const wrapper = mount(MatchCard, { props: { match: liveMatch, now: NOW } })
    expect(wrapper.text()).toContain('En vivo')
    // Score must not be displayed for live matches — see specs/matches.md
    // (daily-refresh architecture can't honestly report live scores).
    expect(wrapper.findAll(`[class*="score"]`)).toHaveLength(0)
  })

  it('renders a finished match with the "Final" badge and scores', () => {
    const finishedMatch: Match = {
      ...baseMatch,
      status: 'finished',
      score: { home: 2, away: 1 },
    }
    const wrapper = mount(MatchCard, { props: { match: finishedMatch, now: NOW } })
    expect(wrapper.text()).toContain('Final')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('1')
  })

  it('renders a postponed match with the "Postergado" badge', () => {
    const postponedMatch: Match = { ...baseMatch, status: 'postponed' }
    const wrapper = mount(MatchCard, { props: { match: postponedMatch, now: NOW } })
    expect(wrapper.text()).toContain('Postergado')
  })

  it('renders nothing for cancelled matches', () => {
    const cancelledMatch: Match = { ...baseMatch, status: 'cancelled' }
    const wrapper = mount(MatchCard, { props: { match: cancelledMatch, now: NOW } })
    expect(wrapper.html().trim()).toBe('<!--v-if-->')
  })

  it('renders mini-flag <img> elements with the resolved src per team', () => {
    const wrapper = mount(MatchCard, { props: { match: baseMatch, now: NOW } })
    const imgs = wrapper.findAll('img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]!.attributes('src')).toBe('/flags/mx.svg')
    expect(imgs[1]!.attributes('src')).toBe('/flags/jp.svg')
  })

  it('omits the mini-flag <img> when resolveFlag returns null', () => {
    const unknownTeamMatch: Match = {
      ...baseMatch,
      teamA: { iso: 'zz', name: 'Desconocido' },
    }
    const wrapper = mount(MatchCard, { props: { match: unknownTeamMatch, now: NOW } })
    // Only team B has a resolvable flag; team A renders empty mini-flag wrapper.
    expect(wrapper.findAll('img')).toHaveLength(1)
    expect(wrapper.text()).toContain('Desconocido')
  })

  it('sets per-team CSS custom properties on the root element for the halo', () => {
    const derbyMatch: Match = {
      ...baseMatch,
      teamA: { iso: 'ar', name: 'Argentina' },
      teamB: { iso: 'br', name: 'Brasil' },
    }
    const wrapper = mount(MatchCard, { props: { match: derbyMatch, now: NOW } })
    const style = wrapper.find('li').attributes('style') ?? ''
    expect(style).toMatch(/--team-a-glow:\s*[^;]+/)
    expect(style).toMatch(/--team-b-glow:\s*[^;]+/)
    // Each property must be set to a non-empty value (a hex color from resolveGlow).
    const aMatch = style.match(/--team-a-glow:\s*([^;]+)/)
    const bMatch = style.match(/--team-b-glow:\s*([^;]+)/)
    expect(aMatch?.[1]?.trim()).toBeTruthy()
    expect(bMatch?.[1]?.trim()).toBeTruthy()
  })

  it('exposes an aria-label that summarizes both teams and kickoff', () => {
    const wrapper = mount(MatchCard, { props: { match: baseMatch, now: NOW } })
    const label = wrapper.find('li').attributes('aria-label')
    expect(label).toContain('México')
    expect(label).toContain('Japón')
    expect(label).toContain('Fase de grupos')
    // Format depends on the host TZ; just confirm SOMETHING time-shaped is present.
    expect(label).toMatch(/\d{2}:\d{2}/)
  })

  it('renders the AddToCalendar button for scheduled matches', () => {
    const wrapper = mount(MatchCard, { props: { match: baseMatch, now: NOW } })
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-label') ?? '').toContain('Agregar al calendario')
  })

  it('does NOT render the AddToCalendar button for finished matches', () => {
    const finished: Match = { ...baseMatch, status: 'finished', score: { home: 2, away: 1 } }
    const wrapper = mount(MatchCard, { props: { match: finished, now: NOW } })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('does NOT render the AddToCalendar button when kickoff is already in the past', () => {
    // baseMatch.utcKickoff is 2026-06-14T19:00:00Z. Move `now` past it.
    const past = Date.parse('2026-06-14T20:00:00Z')
    const wrapper = mount(MatchCard, { props: { match: baseMatch, now: past } })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
