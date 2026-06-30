import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BracketTree from '@/bracket/ui/BracketTree.vue'
import { buildBracketModel } from '@/bracket/domain/buildBracketModel'
import { matchListSchema } from '@/matches/domain/match.schema'
import fixtureJson from '@/shared/fixture/matches.fixture.json'
import { useI18n } from '@/shared/i18n/useI18n'

vi.mock('@/shared/flags/resolve', () => ({
  resolveFlag: (iso: string): string | null => `/flags/${iso}.svg`,
}))

const fixture = matchListSchema.parse(fixtureJson)

describe('BracketTree', () => {
  it('renders fixed knockout tracks with aligned slot rows across every stage', () => {
    useI18n().setLocale('es')

    const wrapper = mount(BracketTree, {
      props: {
        model: buildBracketModel(fixture),
        now: Date.parse('2026-06-29T18:00:00Z'),
      },
    })

    expect(wrapper.text()).toContain('32avos')
    expect(wrapper.text()).toContain('16avos')
    expect(wrapper.text()).toContain('Cuartos de final')
    expect(wrapper.text()).toContain('Semifinales')
    expect(wrapper.text()).toContain('Final')
    expect(wrapper.text()).toContain('Tercer puesto')

    const columns = wrapper.findAll('[data-round-column]')
    expect(columns).toHaveLength(5)
    expect(wrapper.find('[data-round-column="round-of-32"]').exists()).toBe(true)
    expect(wrapper.find('[data-round-column="round-of-16"]').exists()).toBe(true)
    expect(wrapper.find('[data-round-column="quarter-final"]').exists()).toBe(true)
    expect(wrapper.find('[data-round-column="semi-final"]').exists()).toBe(true)
    expect(wrapper.find('[data-round-column="terminal"]').exists()).toBe(true)

    expect(wrapper.findAll('[data-stage-track]')).toHaveLength(6)
    expect(wrapper.findAll('[data-stage-track="round-of-32"] [data-match-id]')).toHaveLength(16)
    expect(wrapper.findAll('[data-stage-track="round-of-16"] [data-match-id]')).toHaveLength(8)
    expect(wrapper.findAll('[data-stage-track="quarter-final"] [data-match-id]')).toHaveLength(4)
    expect(wrapper.findAll('[data-stage-track="semi-final"] [data-match-id]')).toHaveLength(2)
    expect(wrapper.findAll('[data-stage-track="final"] [data-match-id]')).toHaveLength(1)
    expect(wrapper.findAll('[data-stage-track="third-place"] [data-match-id]')).toHaveLength(1)

    expect(
      wrapper
        .find('[data-stage-track="round-of-32"] [data-match-id="wc2026-r32-01"]')
        .attributes('data-row-start'),
    ).toBe('1')
    expect(
      wrapper
        .find('[data-stage-track="round-of-32"] [data-match-id="wc2026-r32-16"]')
        .attributes('data-row-start'),
    ).toBe('31')
    expect(
      wrapper
        .find('[data-stage-track="round-of-16"] [data-match-id="wc2026-r16-01"]')
        .attributes('data-row-start'),
    ).toBe('2')
    expect(
      wrapper
        .find('[data-stage-track="quarter-final"] [data-match-id="wc2026-qf-02"]')
        .attributes('data-row-start'),
    ).toBe('12')
    expect(
      wrapper
        .find('[data-stage-track="semi-final"] [data-match-id="wc2026-sf-02"]')
        .attributes('data-row-start'),
    ).toBe('24')
    expect(
      wrapper
        .find('[data-stage-track="final"] [data-match-id="wc2026-final"]')
        .attributes('data-row-start'),
    ).toBe('16')
    expect(
      wrapper
        .find('[data-stage-track="third-place"] [data-match-id="wc2026-3rd"]')
        .attributes('data-row-start'),
    ).toBe('20')

    expect(wrapper.findAll('article')).toHaveLength(32)
  })

  it('keeps empty knockout slots rendered for printable write-in brackets', () => {
    useI18n().setLocale('en')

    const wrapper = mount(BracketTree, {
      props: {
        model: buildBracketModel(fixture.filter((match) => match.stage === 'group')),
        now: Date.parse('2026-06-29T18:00:00Z'),
      },
    })

    expect(wrapper.text()).toContain('Round of 32')
    expect(wrapper.text()).toContain('Third place')
    expect(wrapper.findAll('article')).toHaveLength(32)
    expect(wrapper.findAll('[class*="nodeWritable"]')).toHaveLength(32)
  })
})
