// MINIMAL `useMatches` (T8.7 partial). Walks the data-source fallback chain
// once at module load and exposes the resolved match set as a reactive
// singleton.
//
// What's HERE (this batch):
//  - One-shot load on module init via `createMatchSourceChain(env)` + `chooseSource`.
//  - Reactive `matches`, `status`, `sourceName`.
//  - `status` is the spec'd union MINUS `'degraded'`: a successful load
//    collapses to `'ready'` regardless of which adapter won, so the
//    MainView can render the FeaturedCard today. The full discrimination
//    (fixture-fallback → `'degraded'`, with a passive UI indicator) lands
//    in the remaining B-2 work.
//
// What's DEFERRED to B-2 remainder:
//  - `refresh()` (visibility-change + manual refresh).
//  - `generatedAt` for staleness UI.
//  - `'degraded'` state (when remote+history failed and we landed on the
//    bundled fixture) surfaced to the UI per data-source.md §4.
//  - Re-evaluation hook for derived state (consumers currently observe
//    refs directly via Vue reactivity; the explicit re-eval hook arrives
//    with `refresh()`).
//
// Module-singleton pattern: mirrors `useTheme.ts` / `useI18n.ts` /
// `router.ts`. The load promise is kicked off ONCE at module load; every
// `useMatches()` call returns refs that point at the same in-memory state.

import { readonly, ref, type Ref } from 'vue'
import { createMatchSourceChain } from '@/app/match-source-chain'
import { chooseSource } from '@/matches/adapters/choose-source'
import type { Match } from '@/matches/domain/match'

export type MatchesStatus = 'idle' | 'loading' | 'ready' | 'error'

const matches = ref<readonly Match[]>([])
const status = ref<MatchesStatus>('idle')
const sourceName = ref<string | null>(null)

let loadPromise: Promise<void> | null = null

function startLoad(): Promise<void> {
  if (loadPromise !== null) return loadPromise
  status.value = 'loading'
  loadPromise = (async () => {
    try {
      const chain = createMatchSourceChain(import.meta.env)
      const chosen = await chooseSource(chain)
      if (chosen === null) {
        status.value = 'error'
        return
      }
      matches.value = chosen.matches
      sourceName.value = chosen.sourceName
      status.value = 'ready'
    } catch {
      // The walker swallows source-level errors, so this branch is purely
      // defensive against an unexpected throw from the composition root
      // (e.g. a bad env shape in a future refactor).
      status.value = 'error'
    }
  })()
  return loadPromise
}

// Kick the load off at module init — singleton lifecycle. We do NOT await:
// consumers observe the refs and re-render as `status` flips. SSR-safe
// because `import.meta.env` and the adapters are isomorphic; the only
// network-touching adapter (`RemoteSource`) gates on `fetch` being defined.
void startLoad()

export interface UseMatchesReturn {
  readonly matches: Readonly<Ref<readonly Match[]>>
  readonly status: Readonly<Ref<MatchesStatus>>
  readonly sourceName: Readonly<Ref<string | null>>
}

export function useMatches(): UseMatchesReturn {
  return {
    matches: readonly(matches),
    status: readonly(status),
    sourceName: readonly(sourceName),
  }
}

// Test-only helper: re-run the load and return the in-flight promise so
// tests can await readiness without polling. Production code MUST NOT call
// this — the production path is "module load triggers exactly one load".
export function __reloadMatchesForTests(): Promise<void> {
  loadPromise = null
  matches.value = []
  sourceName.value = null
  status.value = 'idle'
  return startLoad()
}

// Test-only helper: returns the in-flight load promise (or the resolved one
// if init already completed). Lets tests `await` readiness deterministically.
export function __waitForMatchesLoadForTests(): Promise<void> {
  return loadPromise ?? Promise.resolve()
}

// Test-only helper: park the singleton in 'idle' WITHOUT kicking a load.
// Production code MUST NOT call this — loads are auto-started at module
// init. Tests that want to assert the pre-load UI need a way to inhibit
// the auto-load between runs.
export function __parkMatchesAtIdleForTests(): void {
  loadPromise = null
  matches.value = []
  sourceName.value = null
  status.value = 'idle'
}
