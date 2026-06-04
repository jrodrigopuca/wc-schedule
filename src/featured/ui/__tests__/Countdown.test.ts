import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'
import Countdown from '@/featured/ui/Countdown.vue'

const NOW = 1_700_000_000_000

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __setClockForTests(() => NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetClockForTests()
  })

  it('renders HH:MM:SS for a sub-day target', () => {
    // 2h 34m 15s ahead.
    const target = NOW + (2 * 3600 + 34 * 60 + 15) * 1000
    const wrapper = mount(Countdown, { props: { targetMs: target } })
    // No days segment.
    expect(wrapper.text()).not.toMatch(/·/)
    expect(wrapper.text().replace(/\s+/g, '')).toBe('02:34:15')
    wrapper.unmount()
  })

  it('advances by one second after a 1s tick', async () => {
    let nowMs = NOW
    __setClockForTests(() => nowMs)
    const target = nowMs + 5_000
    const wrapper = mount(Countdown, { props: { targetMs: target } })
    expect(wrapper.text().replace(/\s+/g, '')).toBe('00:00:05')

    nowMs += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(wrapper.text().replace(/\s+/g, '')).toBe('00:00:04')

    wrapper.unmount()
  })

  it('clamps to 00:00:00 at expiry', async () => {
    let nowMs = NOW
    __setClockForTests(() => nowMs)
    const target = nowMs + 1_000
    const wrapper = mount(Countdown, { props: { targetMs: target } })

    nowMs += 5_000
    await vi.advanceTimersByTimeAsync(5_000)
    expect(wrapper.text().replace(/\s+/g, '')).toBe('00:00:00')

    wrapper.unmount()
  })

  it('prepends days when remaining >= 24h', () => {
    // 2 days, 3h, 4m, 5s.
    const target = NOW + (2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000
    const wrapper = mount(Countdown, { props: { targetMs: target } })
    const flattened = wrapper.text().replace(/\s+/g, '')
    expect(flattened).toBe('02·03:04:05')
    wrapper.unmount()
  })

  it('uses aria-live=polite and exposes a readable label', () => {
    const target = NOW + 5_000
    const wrapper = mount(Countdown, { props: { targetMs: target } })
    const root = wrapper.find('output')
    expect(root.attributes('aria-live')).toBe('polite')
    expect(root.attributes('aria-label')).toBe('00:00:05')
    wrapper.unmount()
  })
})
