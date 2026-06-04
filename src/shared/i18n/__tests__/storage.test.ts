import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STORAGE_KEY,
  clearStoredLocale,
  readStoredLocale,
  writeStoredLocale,
} from '@/shared/i18n/storage'

describe('locale storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('round-trips read/write/clear for "es"', () => {
    writeStoredLocale('es')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('es')
    expect(readStoredLocale()).toBe('es')

    clearStoredLocale()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(readStoredLocale()).toBeNull()
  })

  it('round-trips read/write/clear for "en"', () => {
    writeStoredLocale('en')
    expect(readStoredLocale()).toBe('en')

    clearStoredLocale()
    expect(readStoredLocale()).toBeNull()
  })

  it('returns null when the stored value is not a known locale', () => {
    localStorage.setItem(STORAGE_KEY, 'fr')
    expect(readStoredLocale()).toBeNull()
  })

  it('returns null when the key is missing', () => {
    expect(readStoredLocale()).toBeNull()
  })

  it('treats localStorage failures as a no-op on read', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredLocale()).toBeNull()
  })

  it('treats localStorage failures as a no-op on write', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => {
      writeStoredLocale('en')
    }).not.toThrow()
  })

  it('treats localStorage failures as a no-op on clear', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => {
      clearStoredLocale()
    }).not.toThrow()
  })
})
