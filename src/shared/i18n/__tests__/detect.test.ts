import { describe, expect, it } from 'vitest'
import { readLocaleFromBrowser } from '@/shared/i18n/detect'

function nav(language: string, languages: readonly string[] = []) {
  return { language, languages } as unknown as Pick<Navigator, 'language' | 'languages'>
}

describe('readLocaleFromBrowser', () => {
  it('maps "es-AR" to "es"', () => {
    expect(readLocaleFromBrowser(nav('es-AR'))).toBe('es')
  })

  it('maps "en-US" to "en"', () => {
    expect(readLocaleFromBrowser(nav('en-US'))).toBe('en')
  })

  it('defaults to "es" for an unsupported tag like "fr"', () => {
    expect(readLocaleFromBrowser(nav('fr'))).toBe('es')
  })

  it('defaults to "es" when language and languages are both empty', () => {
    expect(readLocaleFromBrowser(nav('', []))).toBe('es')
  })

  it('prefers a supported tag earlier in languages over a later one', () => {
    expect(readLocaleFromBrowser(nav('fr-FR', ['fr-FR', 'en-US', 'es-ES']))).toBe('en')
  })

  it('handles missing languages array gracefully', () => {
    const partial = { language: 'es-ES' } as unknown as Pick<Navigator, 'language' | 'languages'>
    expect(readLocaleFromBrowser(partial)).toBe('es')
  })
})
