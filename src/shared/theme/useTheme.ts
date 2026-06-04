import { computed, ref, type ComputedRef } from 'vue'
import { clearStoredTheme, readStoredTheme, writeStoredTheme } from './storage'

export type Theme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const stored = ref<Theme | null>(readStoredTheme())
const osPrefersDark = ref<boolean>(resolveInitialOsPreference())

const current = computed<Theme>(() =>
  stored.value !== null ? stored.value : osPrefersDark.value ? 'dark' : 'light',
)

attachOsPreferenceListener()

export interface UseThemeReturn {
  readonly current: ComputedRef<Theme>
  setTheme(value: Theme): void
  clearOverride(): void
}

export function useTheme(): UseThemeReturn {
  return {
    current,
    setTheme,
    clearOverride,
  }
}

function setTheme(value: Theme): void {
  stored.value = value
  writeStoredTheme(value)
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', value)
  }
}

function clearOverride(): void {
  stored.value = null
  clearStoredTheme()
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-theme')
  }
  osPrefersDark.value = resolveOsPreference()
}

function resolveInitialOsPreference(): boolean {
  return resolveOsPreference()
}

function resolveOsPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(DARK_QUERY).matches
}

function attachOsPreferenceListener(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }
  const mq = window.matchMedia(DARK_QUERY)
  // Singleton lifecycle: listener lives for the lifetime of the module. The
  // composable never tears it down — multiple components share one source.
  mq.addEventListener('change', (event) => {
    if (stored.value === null) {
      osPrefersDark.value = event.matches
    }
  })
}
