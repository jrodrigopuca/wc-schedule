// Mini hash router. Singleton module-scoped state, no deps. Mirrors the
// shape of `useTheme.ts` / `useI18n.ts`: a private reactive ref initialized
// at module load, a one-shot environment listener, and a `useX()` composable
// that exposes a `ComputedRef` plus an imperative setter (`navigate`).
//
// Two routes only: 'main' (the real app) and 'preview' (the component gallery).

import { computed, ref, type ComputedRef } from 'vue'

export type Route = 'main' | 'preview'

const PREVIEW_PREFIX = '#/preview'

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
  if (raw === PREVIEW_PREFIX) return 'preview'
  if (raw.startsWith(`${PREVIEW_PREFIX}/`)) return 'preview'
  if (raw.startsWith(`${PREVIEW_PREFIX}?`)) return 'preview'
  return 'main'
}

function navigate(route: Route): void {
  if (typeof window === 'undefined') return
  const target = route === 'preview' ? PREVIEW_PREFIX : ''
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

function attachHashChangeListener(): void {
  if (typeof window === 'undefined') return
  // Singleton lifecycle: listener lives for the lifetime of the module.
  window.addEventListener('hashchange', () => {
    current.value = parseHash(window.location.hash)
  })
}
