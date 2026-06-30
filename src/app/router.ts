// Mini hash router. Singleton module-scoped state, no deps. Mirrors the
// shape of `useTheme.ts` / `useI18n.ts`: a private reactive ref initialized
// at module load, a one-shot environment listener, and a `useX()` composable
// that exposes a `ComputedRef` plus an imperative setter (`navigate`).
//
// Three routes only: 'main' (the real app), 'preview' (the component
// gallery), and 'bracket' (the printable knockout screen).

import { computed, ref, type ComputedRef } from 'vue'

export const ROUTE = {
  MAIN: 'main',
  PREVIEW: 'preview',
  BRACKET: 'bracket',
} as const

export type Route = (typeof ROUTE)[keyof typeof ROUTE]

const PREVIEW_PREFIX = '#/preview'
const BRACKET_PREFIX = '#/bracket'

const current = ref<Route>(parseHash(readHash()))

attachHashChangeListener()

export interface UseRouteReturn {
  readonly current: ComputedRef<Route>
  navigate(route: Route): void
}

export function useRoute(): UseRouteReturn {
  return {
    current: computed(() => current.value),
    navigate,
  }
}

export function parseHash(rawHash?: string): Route {
  const raw = rawHash ?? ''
  if (matchesRoutePrefix(raw, PREVIEW_PREFIX)) return ROUTE.PREVIEW
  if (matchesRoutePrefix(raw, BRACKET_PREFIX)) return ROUTE.BRACKET
  return ROUTE.MAIN
}

function navigate(route: Route): void {
  if (typeof window === 'undefined') return
  const target = toHash(route)
  if (window.location.hash === target) {
    // No event fires when the hash is identical — update the ref directly so
    // programmatic re-navigation still re-renders.
    current.value = route
    return
  }
  window.location.hash = target
}

function readHash(): string {
  if (typeof window === 'undefined') return ''
  return window.location.hash
}

function matchesRoutePrefix(rawHash: string, prefix: string): boolean {
  return rawHash === prefix || rawHash.startsWith(`${prefix}/`) || rawHash.startsWith(`${prefix}?`)
}

function toHash(route: Route): string {
  if (route === ROUTE.PREVIEW) return PREVIEW_PREFIX
  if (route === ROUTE.BRACKET) return BRACKET_PREFIX
  return ''
}

function attachHashChangeListener(): void {
  if (typeof window === 'undefined') return
  // Singleton lifecycle: listener lives for the lifetime of the module.
  window.addEventListener('hashchange', () => {
    current.value = parseHash(window.location.hash)
  })
}
