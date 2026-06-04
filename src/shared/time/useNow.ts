// `useNow` is the app-wide tick source: a singleton `Ref<number>` updated
// once per second from `getNow()`. Composables that need to re-evaluate on
// the wall clock (e.g. `useFeatured`) read this ref and let Vue's reactivity
// handle the recomputation.
//
// Design notes:
// - Module-scoped singleton: there is exactly ONE tick driving the whole
//   app; mounting/unmounting components does not start/stop additional
//   timers. This mirrors `useTheme.ts` / `useI18n.ts` / `router.ts`.
// - Cadence: 1000 ms via `setTimeout` (not `setInterval`). Each tick
//   recomputes `now.value = getNow()` — that single line IS the drift
//   correction, identical in shape to `useCountdown.ts`.
// - Coexists with `useCountdown`: the per-target countdown owns its own
//   tick because it watches a `targetMs` that can change independently of
//   the wall clock. Two ticks running side by side is fine.
// - SSR-safe: starting the tick is gated on `typeof window !== 'undefined'`.

import { readonly, ref, type Ref } from 'vue'
import { getNow } from '@/shared/time/now'

const TICK_MS = 1_000

const now = ref(getNow())

let tickHandle: ReturnType<typeof setTimeout> | null = null

function tick(): void {
  now.value = getNow()
  tickHandle = setTimeout(tick, TICK_MS)
}

if (typeof window !== 'undefined') {
  // Kick off the singleton tick at module load — the first consumer that
  // calls `useNow()` gets a ref that is already ticking, and so does every
  // subsequent consumer.
  tickHandle = setTimeout(tick, TICK_MS)
}

export interface UseNowReturn {
  readonly now: Readonly<Ref<number>>
}

export function useNow(): UseNowReturn {
  return { now: readonly(now) }
}

// Test-only helpers. NEVER call these from production code — they exist so
// the singleton can be deterministically reset between tests.
export function __resetNowForTests(): void {
  if (tickHandle !== null) {
    clearTimeout(tickHandle)
    tickHandle = null
  }
  now.value = getNow()
}

export function __startNowForTests(): void {
  if (tickHandle === null && typeof window !== 'undefined') {
    tickHandle = setTimeout(tick, TICK_MS)
  }
}
