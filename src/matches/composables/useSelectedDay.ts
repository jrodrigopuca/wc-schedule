// `useSelectedDay` — singleton composable that tracks the currently
// selected day via the URL hash (`#/day/YYYY-MM-DD`).
//
// Mirrors the lifecycle of `router.ts`: a module-scoped reactive ref
// initialized at module load, a one-shot `hashchange` listener, and a
// `useSelectedDay()` composable that exposes a `ComputedRef` plus an
// imperative `selectDay()` setter.
//
// Coexistence with `router.ts`:
//   - `router.ts` treats any `#/day/...` URL as the `'main'` route (the
//     preview prefix wins over everything else). The two listeners
//     observe the same `hashchange` event and react independently.
//   - The day-selection state lives here; the route classification lives
//     in `router.ts`. Both can fire on the same hash transition.
//
// Validation:
//   - `parseSelectedDay` extracts the raw YMD substring without any
//     calendar-shape validation (e.g. `'2026-13-99'` is returned as-is).
//     The UI decides what to do with out-of-range values. This keeps the
//     parser dumb and the rendering layer in charge of presentation.

import { computed, ref, type ComputedRef } from 'vue'

const DAY_PREFIX = '#/day/'

const selectedYMD = ref<string | null>(parseSelectedDay(readHash()))

attachHashChangeListener()

export interface UseSelectedDayReturn {
  readonly selectedYMD: ComputedRef<string | null>
  selectDay(ymd: string | null): void
}

export function useSelectedDay(): UseSelectedDayReturn {
  return {
    selectedYMD: computed(() => selectedYMD.value),
    selectDay,
  }
}

export function parseSelectedDay(rawHash?: string): string | null {
  const raw = rawHash ?? ''
  if (!raw.startsWith(DAY_PREFIX)) return null
  const remainder = raw.slice(DAY_PREFIX.length)
  if (remainder.length === 0) return null
  // Capture up to the next `/`, `?`, or end-of-string. We don't validate
  // the calendar shape — see file header for rationale.
  const match = remainder.match(/^([^/?#]+)/)
  return match?.[1] ?? null
}

function selectDay(ymd: string | null): void {
  if (typeof window === 'undefined') {
    selectedYMD.value = ymd
    return
  }
  const target = ymd === null ? '' : `${DAY_PREFIX}${ymd}`
  if (window.location.hash === target) {
    // No event fires when the hash is identical — update the ref directly
    // so programmatic re-navigation still re-renders (mirrors `router.ts`).
    selectedYMD.value = ymd
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
    selectedYMD.value = parseSelectedDay(window.location.hash)
  })
}

// Test-only helper: reset the singleton state to whatever the current
// hash dictates. Mirrors the `__reset*ForTests` convention used by
// other composables.
export function __resetSelectedDayForTests(): void {
  selectedYMD.value = parseSelectedDay(readHash())
}
