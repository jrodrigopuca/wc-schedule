import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STORAGE_KEY,
  clearStoredTheme,
  readStoredTheme,
  writeStoredTheme,
} from '@/shared/theme/storage'

describe('theme storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('round-trips read/write/clear for "light"', () => {
    writeStoredTheme('light')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    expect(readStoredTheme()).toBe('light')

    clearStoredTheme()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(readStoredTheme()).toBeNull()
  })

  it('round-trips read/write/clear for "dark"', () => {
    writeStoredTheme('dark')
    expect(readStoredTheme()).toBe('dark')

    clearStoredTheme()
    expect(readStoredTheme()).toBeNull()
  })

  it('returns null when the stored value is not a known theme', () => {
    localStorage.setItem(STORAGE_KEY, 'sepia')
    expect(readStoredTheme()).toBeNull()
  })

  it('returns null when the key is missing', () => {
    expect(readStoredTheme()).toBeNull()
  })

  it('treats localStorage failures as a no-op on read', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredTheme()).toBeNull()
  })

  it('treats localStorage failures as a no-op on write', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => {
      writeStoredTheme('dark')
    }).not.toThrow()
  })

  it('treats localStorage failures as a no-op on clear', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => {
      clearStoredTheme()
    }).not.toThrow()
  })
})
