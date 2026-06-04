import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'
import { __resetNowForTests, __startNowForTests, useNow } from '@/shared/time/useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Reset the singleton state so each test starts from a known clock value
    // with no pending tick. We then re-arm the tick under fake timers, which
    // is what production code does once at module load.
    __resetNowForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetClockForTests()
    __resetNowForTests()
  })

  it('exposes the current value of getNow() at the time of the first read', () => {
    const T0 = 1_700_000_000_000
    __setClockForTests(() => T0)
    __resetNowForTests()
    const { now } = useNow()
    expect(now.value).toBe(T0)
  })

  it('updates the ref after the 1s tick fires', async () => {
    let clock = 1_700_000_000_000
    __setClockForTests(() => clock)
    __resetNowForTests()
    __startNowForTests()

    const { now } = useNow()
    expect(now.value).toBe(clock)

    clock += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(now.value).toBe(clock)

    clock += 2_000
    await vi.advanceTimersByTimeAsync(2_000)
    // Two more 1s ticks fired — the ref reflects the latest clock reading.
    expect(now.value).toBe(clock)
  })

  it('shares a single ref across consumers (singleton invariant)', async () => {
    let clock = 1_700_000_000_000
    __setClockForTests(() => clock)
    __resetNowForTests()
    __startNowForTests()

    const a = useNow()
    const b = useNow()
    expect(a.now.value).toBe(b.now.value)
    // Identity: both consumers see the exact same reactive ref instance.
    expect(a.now).toBe(b.now)

    clock += 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(a.now.value).toBe(clock)
    expect(b.now.value).toBe(clock)
    expect(a.now.value).toBe(b.now.value)
  })
})
