export type StoredTheme = 'light' | 'dark'

export const STORAGE_KEY = 'wc-theme'

export function readStoredTheme(): StoredTheme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'light' || raw === 'dark' ? raw : null
  } catch {
    return null
  }
}

export function writeStoredTheme(value: StoredTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* noop — privacy mode or SSR */
  }
}

export function clearStoredTheme(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop — privacy mode or SSR */
  }
}
