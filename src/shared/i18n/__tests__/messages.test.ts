import { describe, expect, it } from 'vitest'
import { MESSAGES } from '@/shared/i18n/messages'

describe('MESSAGES table', () => {
  it('has identical key sets for "es" and "en"', () => {
    const esKeys = Object.keys(MESSAGES.es).sort()
    const enKeys = Object.keys(MESSAGES.en).sort()
    expect(enKeys).toEqual(esKeys)
  })

  it('has no empty strings in either locale', () => {
    for (const locale of ['es', 'en'] as const) {
      for (const [key, value] of Object.entries(MESSAGES[locale])) {
        expect(value.length, `${locale}.${key} must be a non-empty string`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps placeholder shape consistent across locales for keys that use one', () => {
    // If ES uses {n}, EN must too, otherwise we have a translation bug.
    for (const key of Object.keys(MESSAGES.es) as readonly (keyof typeof MESSAGES.es)[]) {
      const esPlaceholders = collectPlaceholders(MESSAGES.es[key])
      const enPlaceholders = collectPlaceholders(MESSAGES.en[key])
      expect(enPlaceholders, `${key} placeholders out of sync`).toEqual(esPlaceholders)
    }
  })
})

function collectPlaceholders(template: string): readonly string[] {
  return Array.from(template.matchAll(/\{(\w+)\}/g))
    .map((m) => m[1] as string)
    .sort()
}
