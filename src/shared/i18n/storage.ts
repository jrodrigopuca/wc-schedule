// Locale persistence. Mirrors the shape of `src/shared/theme/storage.ts`
// intentionally: same try/catch wrapping for privacy mode, same null on
// invalid/missing values, same triplet of read/write/clear. If you change
// the surface here, change it there too.

import type { Locale } from './types'

export const STORAGE_KEY = 'wc-locale'

export function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'es' || raw === 'en' ? raw : null
  } catch {
    return null
  }
}

export function writeStoredLocale(value: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* noop — privacy mode or SSR */
  }
}

export function clearStoredLocale(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop — privacy mode or SSR */
  }
}
