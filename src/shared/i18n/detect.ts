import type { Locale } from './types'

// Browser locale detection. Pure-ish: accepts an optional `nav` so tests can
// inject a fake without monkey-patching globalThis.navigator. Falls back to
// 'es' (the project's default) when nothing usable is found — the data is
// primarily Spanish-speaking audience targeted (LATAM World Cup viewers).

type NavLike = Pick<Navigator, 'language' | 'languages'>

export function readLocaleFromBrowser(nav?: NavLike): Locale {
  const source = nav ?? readDefaultNavigator()
  if (source === null) return 'es'

  const candidates: readonly string[] = collectCandidates(source)
  for (const tag of candidates) {
    const locale = matchLocale(tag)
    if (locale !== null) return locale
  }
  return 'es'
}

function readDefaultNavigator(): NavLike | null {
  if (typeof navigator === 'undefined') return null
  return navigator
}

function collectCandidates(nav: NavLike): readonly string[] {
  const list: string[] = []
  if (Array.isArray(nav.languages)) {
    for (const tag of nav.languages) {
      if (typeof tag === 'string' && tag.length > 0) list.push(tag)
    }
  }
  if (typeof nav.language === 'string' && nav.language.length > 0) {
    list.push(nav.language)
  }
  return list
}

function matchLocale(tag: string): Locale | null {
  const head = tag.toLowerCase().split('-')[0]
  if (head === 'es') return 'es'
  if (head === 'en') return 'en'
  return null
}
