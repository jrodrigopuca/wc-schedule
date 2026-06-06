// `useMatches` — the singleton match-data composable. Walks the
// data-source fallback chain at module load, exposes the resolved set as
// reactive refs, and surfaces both the source identity (so the UI can flag
// degraded fallbacks) and a refresh affordance (manual + visibility-driven).
//
// Behavior:
//  - On module load, kick off ONE load via `chooseSource(chain)`. The initial
//    transition is `'idle' → 'loading' → 'ready' | 'degraded' | 'error'`.
//  - `'degraded'` (per data-source.md §5 / specs/matches.md AC-7, AC-8): when
//    the build was configured as `VITE_DATA_SOURCE === 'remote'` but the
//    winning adapter is NOT `'remote'` (history or manual fallback). In
//    `manual` mode the only valid source IS the fixture, so a successful
//    load there ALWAYS collapses to `'ready'`.
//  - `refresh()` re-runs the chain. Atomic replacement (specs/matches.md
//    AC-7): only mutate `matches` / `sourceName` / `generatedAt` if the new
//    walk succeeded. Failed refresh (AC-8): preserves prior state — no
//    flicker, no rollback to `'loading'` or `'error'`.
//  - Background refreshes (after a successful initial load) do NOT show
//    `'loading'`. Only the cold start surfaces `'loading'`; thereafter the
//    UI sees a stable `'ready' | 'degraded'` even while a refresh is in
//    flight. This keeps the visible status stable per AC-7's "no observable
//    partial state" rule.
//  - A singleton `visibilitychange` listener attached at module load calls
//    `refresh()` when the document becomes visible again. SSR-safe: the
//    attach is gated on `typeof document !== 'undefined'`. Singleton
//    lifecycle — attached once, never removed (mirrors `useTheme` /
//    `router` `addEventListener` pattern).
//
// Module-singleton pattern: mirrors `useTheme.ts` / `useI18n.ts` /
// `router.ts`. The initial load promise is kicked off ONCE at module load;
// every `useMatches()` call returns refs that point at the same in-memory
// state.

import { readonly, ref, type Ref } from 'vue'
import { createMatchSourceChain } from '@/app/match-source-chain'
import { chooseSource, type ChosenSource } from '@/matches/adapters/choose-source'
import type { Match } from '@/matches/domain/match'
import { getNow } from '@/shared/time/now'

export type MatchesStatus = 'idle' | 'loading' | 'ready' | 'degraded' | 'error'

// Pluggable loader. Production wires this to a closure that walks
// `createMatchSourceChain(import.meta.env)`. Tests can override via
// `__setChooseSourceForTests` to control the outcome deterministically
// without standing up a fake fetch server.
type Loader = () => Promise<ChosenSource | null>

const defaultLoader: Loader = () => chooseSource(createMatchSourceChain(import.meta.env))

let loader: Loader = defaultLoader

const matches = ref<readonly Match[]>([])
const status = ref<MatchesStatus>('idle')
const sourceName = ref<string | null>(null)
const generatedAt = ref<number | null>(null)

let loadPromise: Promise<void> | null = null
// `true` once the initial load has SUCCEEDED. Determines whether subsequent
// refreshes flip status to `'loading'` (cold start only) or stay silent
// (background refresh).
let initialLoadComplete = false

function resolveReadyStatus(): MatchesStatus {
  // `'degraded'` only applies when the build was configured for `remote`.
  // In `manual` mode, the fixture IS the source of truth — there's no
  // degradation to report.
  if (import.meta.env.VITE_DATA_SOURCE === 'remote' && sourceName.value !== 'remote') {
    return 'degraded'
  }
  return 'ready'
}

function startLoad(): Promise<void> {
  if (loadPromise !== null) return loadPromise
  status.value = 'loading'
  loadPromise = (async () => {
    try {
      const chosen = await loader()
      if (chosen === null) {
        status.value = 'error'
        return
      }
      matches.value = chosen.matches
      sourceName.value = chosen.sourceName
      generatedAt.value = getNow()
      initialLoadComplete = true
      status.value = resolveReadyStatus()
    } catch {
      // The walker swallows source-level errors, so this branch is purely
      // defensive against an unexpected throw from the composition root
      // (e.g. a bad env shape in a future refactor).
      status.value = 'error'
    }
  })()
  return loadPromise
}

// Tracks an in-flight background refresh so concurrent visibility-change
// events don't fire overlapping loads. The promise is replaced on every
// fresh refresh; callers (e.g. tests) can `await refresh()` directly.
let refreshPromise: Promise<void> | null = null

async function refresh(): Promise<void> {
  // Before the initial load succeeds, `refresh()` collapses to the singleton
  // load. This means an early visibility-change while the cold start is
  // still in flight does nothing extra.
  if (!initialLoadComplete) {
    await startLoad()
    return
  }
  if (refreshPromise !== null) return refreshPromise
  refreshPromise = (async () => {
    try {
      const chosen = await loader()
      if (chosen === null) {
        // Failed refresh preserves prior state (specs/matches.md AC-8).
        // Status MUST NOT flicker — we stay on the post-success status.
        return
      }
      // Atomic replacement (AC-7): mutate refs only after a successful walk.
      matches.value = chosen.matches
      sourceName.value = chosen.sourceName
      generatedAt.value = getNow()
      status.value = resolveReadyStatus()
    } catch {
      // Failed refresh — keep prior state, don't surface an error UI.
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

// Singleton visibility-change listener. Attached once at module load, never
// removed (mirrors `useTheme`'s matchMedia subscription and `router`'s
// hashchange subscription). SSR-safe: gated on `document` existence.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void refresh()
    }
  })
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
  readonly generatedAt: Readonly<Ref<number | null>>
  refresh(): Promise<void>
}

export function useMatches(): UseMatchesReturn {
  return {
    matches: readonly(matches),
    status: readonly(status),
    sourceName: readonly(sourceName),
    generatedAt: readonly(generatedAt),
    refresh,
  }
}

// Test-only helper: re-run the load and return the in-flight promise so
// tests can await readiness without polling. Production code MUST NOT call
// this — the production path is "module load triggers exactly one load".
export function __reloadMatchesForTests(): Promise<void> {
  loadPromise = null
  refreshPromise = null
  initialLoadComplete = false
  matches.value = []
  sourceName.value = null
  generatedAt.value = null
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
  refreshPromise = null
  initialLoadComplete = false
  matches.value = []
  sourceName.value = null
  generatedAt.value = null
  status.value = 'idle'
}

// Test-only helper: full reset of singleton state — matches/sourceName/
// generatedAt cleared, status returned to `'idle'`, in-flight promises
// dropped, AND the injected loader (if any) restored to the production
// default. Mirrors `__parkMatchesAtIdleForTests` but is the canonical
// "between tests" hook for the new B-2a tests.
export function __resetMatchesForTests(): void {
  loadPromise = null
  refreshPromise = null
  initialLoadComplete = false
  loader = defaultLoader
  matches.value = []
  sourceName.value = null
  generatedAt.value = null
  status.value = 'idle'
}

// Test-only helper: swap the loader used by `startLoad` / `refresh`. Lets
// tests control success/failure and the resolved `ChosenSource` shape
// without standing up a fake fetch server or mocking the chain module.
// Reset via `__resetMatchesForTests`.
export function __setChooseSourceForTests(fn: Loader): void {
  loader = fn
}
