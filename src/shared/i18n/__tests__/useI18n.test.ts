import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '@/shared/i18n/storage'

function stubNavigator(language: string, languages: readonly string[] = [language]): void {
  vi.stubGlobal('navigator', { language, languages })
}

async function loadUseI18n(): Promise<typeof import('@/shared/i18n/useI18n')> {
  vi.resetModules()
  return import('@/shared/i18n/useI18n')
}

describe('useI18n composable', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('honors the stored override over browser detection', async () => {
    localStorage.setItem(STORAGE_KEY, 'en')
    stubNavigator('es-AR')

    const { useI18n } = await loadUseI18n()
    const i18n = useI18n()

    expect(i18n.current.value).toBe('en')
    expect(i18n.t('match.badge.scheduled')).toBe('Scheduled')
  })

  it('falls back to browser detection when nothing is stored', async () => {
    stubNavigator('en-US')

    const { useI18n } = await loadUseI18n()
    const i18n = useI18n()

    expect(i18n.current.value).toBe('en')
  })

  it('defaults to "es" when neither storage nor browser supply a supported tag', async () => {
    stubNavigator('fr-FR', ['fr-FR'])

    const { useI18n } = await loadUseI18n()
    const i18n = useI18n()

    expect(i18n.current.value).toBe('es')
  })

  it('setLocale updates state and persists to storage', async () => {
    stubNavigator('es-AR')

    const { useI18n } = await loadUseI18n()
    const i18n = useI18n()
    expect(i18n.current.value).toBe('es')

    i18n.setLocale('en')

    expect(i18n.current.value).toBe('en')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')
  })

  it('clearOverride drops storage and falls back to browser-detected locale', async () => {
    stubNavigator('en-US')

    const { useI18n } = await loadUseI18n()
    const i18n = useI18n()
    i18n.setLocale('es')
    expect(i18n.current.value).toBe('es')

    i18n.clearOverride()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(i18n.current.value).toBe('en')
  })

  it('t() interpolates parameters', async () => {
    stubNavigator('es-AR')

    const { useI18n } = await loadUseI18n()
    const i18n = useI18n()

    expect(i18n.t('list.count', { n: 5 })).toBe('5 partidos')
    expect(i18n.t('featured.multiLive.title', { n: 2 })).toBe('Hay 2 partidos en vivo')
  })

  it('country() returns the translated name or null for unknown ISOs', async () => {
    stubNavigator('en-US')

    const { useI18n } = await loadUseI18n()
    const i18n = useI18n()

    expect(i18n.country('ar')).toBe('Argentina')
    expect(i18n.country('AR')).toBe('Argentina') // case-insensitive
    expect(i18n.country('zz')).toBeNull()
  })

  it('country() respects locale switch', async () => {
    stubNavigator('es-AR')

    const { useI18n } = await loadUseI18n()
    const i18n = useI18n()
    expect(i18n.country('br')).toBe('Brasil')

    i18n.setLocale('en')
    expect(i18n.country('br')).toBe('Brazil')
  })
})
