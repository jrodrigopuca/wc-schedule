import { afterEach, describe, expect, it } from 'vitest'
import { __resetClockForTests, __setClockForTests, getNow } from '@/shared/time/now'

describe('getNow', () => {
  afterEach(() => {
    __resetClockForTests()
  })

  it('defaults to Date.now()', () => {
    const before = Date.now()
    const value = getNow()
    const after = Date.now()
    expect(value).toBeGreaterThanOrEqual(before)
    expect(value).toBeLessThanOrEqual(after)
  })

  it('__setClockForTests overrides the clock', () => {
    __setClockForTests(() => 1_700_000_000_000)
    expect(getNow()).toBe(1_700_000_000_000)
  })

  it('__resetClockForTests restores Date.now()', () => {
    __setClockForTests(() => 42)
    expect(getNow()).toBe(42)
    __resetClockForTests()
    const before = Date.now()
    const value = getNow()
    const after = Date.now()
    expect(value).toBeGreaterThanOrEqual(before)
    expect(value).toBeLessThanOrEqual(after)
  })
})
