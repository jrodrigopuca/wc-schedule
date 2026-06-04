import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'
import { useCountdown } from '@/featured/composables/useCountdown'

function mountWith<TBindings extends object>(setup: () => TBindings) {
  const exposed: { value: TBindings | null } = { value: null }
  const Test = defineComponent({
    setup() {
      const bindings = setup()
      exposed.value = bindings
      return () => h('div')
    },
  })
  const wrapper = mount(Test)
  if (exposed.value === null) {
    throw new Error('mountWith: setup did not run')
  }
  return { wrapper, bindings: exposed.value }
}

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetClockForTests()
  })

  it('exposes the initial remaining as (target - now) clamped to >= 0', () => {
    const nowMs = 1_000_000
    __setClockForTests(() => nowMs)
    const target = nowMs + 10_000

    const { wrapper, bindings } = mountWith(() => useCountdown(target))
    expect(bindings.remaining.value).toBe(10_000)
    expect(bindings.isExpired.value).toBe(false)
    wrapper.unmount()
  })

  it('decrements by ~1000ms each tick', async () => {
    let nowMs = 1_000_000
    __setClockForTests(() => nowMs)
    const target = nowMs + 10_000

    const { wrapper, bindings } = mountWith(() => useCountdown(target))
    expect(bindings.remaining.value).toBe(10_000)

    nowMs += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(bindings.remaining.value).toBe(9_000)

    nowMs += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(bindings.remaining.value).toBe(8_000)

    wrapper.unmount()
  })

  it('clamps at zero past the target instead of going negative', async () => {
    let nowMs = 1_000_000
    __setClockForTests(() => nowMs)
    const target = nowMs + 2_000

    const { wrapper, bindings } = mountWith(() => useCountdown(target))
    expect(bindings.remaining.value).toBe(2_000)

    // Advance well past the target — remaining must stay at 0, not negative.
    nowMs += 10_000
    await vi.advanceTimersByTimeAsync(5_000)
    expect(bindings.remaining.value).toBe(0)

    wrapper.unmount()
  })

  it('flips isExpired from false to true when remaining hits 0', async () => {
    let nowMs = 1_000_000
    __setClockForTests(() => nowMs)
    const target = nowMs + 1_000

    const { wrapper, bindings } = mountWith(() => useCountdown(target))
    expect(bindings.isExpired.value).toBe(false)

    nowMs += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(bindings.remaining.value).toBe(0)
    expect(bindings.isExpired.value).toBe(true)

    wrapper.unmount()
  })

  it('stops ticking after unmount', async () => {
    let nowMs = 1_000_000
    __setClockForTests(() => nowMs)
    const target = nowMs + 60_000

    const { wrapper, bindings } = mountWith(() => useCountdown(target))
    expect(bindings.remaining.value).toBe(60_000)

    nowMs += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(bindings.remaining.value).toBe(59_000)

    wrapper.unmount()

    // After unmount, advancing the timer and the clock MUST NOT mutate the
    // ref. Any leaked setTimeout would re-read getNow() and update remaining.
    const before = bindings.remaining.value
    nowMs += 30_000
    await vi.advanceTimersByTimeAsync(30_000)
    expect(bindings.remaining.value).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resyncs after a clock jump (backgrounded tab simulation)', async () => {
    let nowMs = 1_000_000
    __setClockForTests(() => nowMs)
    const target = nowMs + 120_000

    const { wrapper, bindings } = mountWith(() => useCountdown(target))
    expect(bindings.remaining.value).toBe(120_000)

    // Simulate a backgrounded tab: the wall clock jumps 60s forward, but
    // only one 1s tick fires when the tab resumes. The recompute MUST
    // observe the full 61s elapsed, not just 1s.
    nowMs += 61_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(bindings.remaining.value).toBe(59_000)

    wrapper.unmount()
  })

  it('restarts when targetMs (passed as a ref) changes', async () => {
    let nowMs = 1_000_000
    __setClockForTests(() => nowMs)
    const target = ref(nowMs + 10_000)

    const { wrapper, bindings } = mountWith(() => useCountdown(target))
    expect(bindings.remaining.value).toBe(10_000)

    nowMs += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(bindings.remaining.value).toBe(9_000)

    // Re-base to a different target (e.g. featured-match swap).
    target.value = nowMs + 30_000
    await vi.advanceTimersByTimeAsync(0) // flush the watcher
    expect(bindings.remaining.value).toBe(30_000)

    nowMs += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(bindings.remaining.value).toBe(29_000)

    wrapper.unmount()
  })
})
