import { describe, expect, it } from 'vitest'
import { resolveFlag } from '@/shared/flags/resolve'

describe('resolveFlag', () => {
  it('returns a truthy URL for a known ISO code', () => {
    const url = resolveFlag('ar')
    expect(url).toBeTruthy()
    expect(typeof url).toBe('string')
  })

  it('returns null for an unknown ISO code', () => {
    expect(resolveFlag('zz')).toBeNull()
  })

  it('is case-insensitive on input', () => {
    expect(resolveFlag('AR')).toBe(resolveFlag('ar'))
  })
})
