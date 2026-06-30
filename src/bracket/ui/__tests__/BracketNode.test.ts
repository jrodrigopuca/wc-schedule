import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BracketNode from '@/bracket/ui/BracketNode.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import type { BracketMatchViewModel } from '@/bracket/domain/bracket'
import { BRACKET_LINEAGE_KIND, BRACKET_ROUND_STAGE } from '@/bracket/domain/bracket'
import type { Match } from '@/matches/domain/match'
import { formatDate, formatTime } from '@/shared/time/format'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

describe('BracketNode', () => {
  it('renders a finished compact node with flags and score', () => {
    useI18n().setLocale('es')
    const kickoff = '2026-07-19T20:00:00Z'

    const wrapper = mount(BracketNode, {
      props: {
        roundMatch: {
          id: 'wc2026-final',
          stage: BRACKET_ROUND_STAGE.FINAL,
          match: makeMatch({
            id: 'wc2026-final',
            stage: 'final',
            status: 'finished',
            teamA: { iso: 'ar', name: 'Argentina' },
            teamB: { iso: 'br', name: 'Brasil' },
            score: { home: 2, away: 1 },
            utcKickoff: kickoff,
          }),
        } satisfies BracketMatchViewModel,
        now: Date.parse('2026-07-19T20:00:00Z'),
      },
    })

    expect(wrapper.text()).toContain('Argentina')
    expect(wrapper.text()).toContain('Brasil')
    expect(wrapper.text()).toContain('Final')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.find('header').text()).toContain(formatDate(kickoff, 'es'))
    expect(wrapper.find('header').text()).toContain(formatTime(kickoff, 'es'))
    expect(wrapper.find('footer').text()).toContain(formatTime(kickoff, 'es'))
    expect(wrapper.find('footer').text()).toMatch(/\d{1,2}\/\d{1,2}/)
    expect(wrapper.findAll('img')).toHaveLength(2)
  })

  it('renders lineage placeholders when the round slot has no concrete match yet', () => {
    useI18n().setLocale('en')

    const wrapper = mount(BracketNode, {
      props: {
        roundMatch: {
          id: 'wc2026-final',
          stage: BRACKET_ROUND_STAGE.FINAL,
          match: null,
          sourceA: { kind: BRACKET_LINEAGE_KIND.WINNER, matchId: 'wc2026-sf-01' },
          sourceB: { kind: BRACKET_LINEAGE_KIND.WINNER, matchId: 'wc2026-sf-02' },
        } satisfies BracketMatchViewModel,
        now: Date.parse('2026-07-19T20:00:00Z'),
      },
    })

    expect(wrapper.text()).not.toContain('Winner SF-01')
    expect(wrapper.text()).not.toContain('Winner SF-02')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findAll(`[class*="teamNameEmpty"]`)).toHaveLength(2)
  })

  it('leaves unresolved participants blank instead of rendering To be determined labels', () => {
    useI18n().setLocale('en')

    const wrapper = mount(BracketNode, {
      props: {
        roundMatch: {
          id: 'wc2026-r16-01',
          stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
          match: makeMatch({
            id: 'fd-537433',
            stage: 'round-of-16',
            teamA: { iso: 'xx', name: 'Winner Match 49' },
            teamB: { iso: 'xx', name: 'Winner Match 50' },
          }),
        } satisfies BracketMatchViewModel,
        now: Date.parse('2026-07-03T20:00:00Z'),
      },
    })

    expect(wrapper.text()).not.toContain('To be determined')
    expect(wrapper.text()).not.toContain('Winner Match 49')
    expect(wrapper.text()).not.toContain('Winner Match 50')
    expect(wrapper.findAll(`[class*="teamNameEmpty"]`)).toHaveLength(2)
    expect(wrapper.classes().some((name) => name.includes('nodeWritable'))).toBe(true)
  })
})

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'wc2026-r32-01',
    utcKickoff: '2026-06-29T20:00:00Z',
    status: 'scheduled',
    stage: 'round-of-32',
    teamA: { iso: 'mx', name: 'México' },
    teamB: { iso: 'jp', name: 'Japón' },
    ...overrides,
  }
}
