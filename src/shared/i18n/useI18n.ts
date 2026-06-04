// Singleton locale state, mirrors `useTheme.ts`. Initial value resolves
// in the same precedence order as theming: stored override → browser
// detection → 'es' default. Listener-free for now — locale doesn't have
// a "system preference change" event to track the way prefers-color-scheme
// does, so there is no analog to the matchMedia subscription.

import { computed, ref, type ComputedRef } from 'vue'
import { readLocaleFromBrowser } from './detect'
import { COUNTRY_NAMES } from './country-names'
import { interpolate } from './interpolate'
import { MESSAGES } from './messages'
import { clearStoredLocale, readStoredLocale, writeStoredLocale } from './storage'
import type { Locale, MessageKey } from './types'

const stored = ref<Locale | null>(readStoredLocale())
const browser = ref<Locale>(readLocaleFromBrowser())

const current = computed<Locale>(() => stored.value ?? browser.value)

export interface UseI18nReturn {
  readonly current: ComputedRef<Locale>
  t(key: MessageKey, params?: Record<string, string | number>): string
  country(iso: string): string | null
  setLocale(value: Locale): void
  clearOverride(): void
}

export function useI18n(): UseI18nReturn {
  return {
    current,
    t,
    country,
    setLocale,
    clearOverride,
  }
}

function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = MESSAGES[current.value][key]
  return interpolate(template, params)
}

function country(iso: string): string | null {
  const table = COUNTRY_NAMES[current.value]
  const value = table[iso.toLowerCase()]
  return value ?? null
}

function setLocale(value: Locale): void {
  stored.value = value
  writeStoredLocale(value)
}

function clearOverride(): void {
  stored.value = null
  clearStoredLocale()
  browser.value = readLocaleFromBrowser()
}
