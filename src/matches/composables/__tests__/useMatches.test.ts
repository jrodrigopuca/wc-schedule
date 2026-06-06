import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __parkMatchesAtIdleForTests,
  __reloadMatchesForTests,
  __resetMatchesForTests,
  __setChooseSourceForTests,
  __waitForMatchesLoadForTests,
  useMatches,
} from '@/matches/composables/useMatches'
import type { Match } from '@/matches/domain/match'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'

const SAMPLE_MATCH_A: Match = {
  id: 'wc2026-a',
  utcKickoff: '2026-06-11T20:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'A',
  teamA: { iso: 'mx', name: 'México' },
  teamB: { iso: 'ar', name: 'Argentina' },
}

const SAMPLE_MATCH_B: Match = {
  id: 'wc2026-b',
  utcKickoff: '2026-06-12T20:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'B',
  teamA: { iso: 'br', name: 'Brasil' },
  teamB: { iso: 'cl', name: 'Chile' },
}

describe('useMatches (minimal — fixture-backed)', () => {
  beforeEach(() => {
    // happy-dom exposes `fetch`; the RemoteSource hit will fail (no server
    // backing the URL), the HistorySource will fail too, and the chain
    // walker falls through to the bundled fixture. That's the expected
    // path in CI: `sourceName` lands on 'manual'.
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    __resetMatchesForTests()
    __resetClockForTests()
  })

  it('reaches "ready" after the singleton load resolves, with the fixture matches loaded', async () => {
    // .env defaults VITE_DATA_SOURCE to 'manual' in vitest — manual+manual
    // is the "no degradation" happy path.
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    await __reloadMatchesForTests()
    const { matches, status } = useMatches()
    expect(status.value).toBe('ready')
    expect(matches.value.length).toBeGreaterThan(0)
  })

  it('lands on the manual fixture (sourceName === "manual") in the test environment', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    await __reloadMatchesForTests()
    const { sourceName } = useMatches()
    expect(sourceName.value).toBe('manual')
  })

  it('is a singleton — every consumer observes the same in-memory matches', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    await __reloadMatchesForTests()
    const a = useMatches()
    const b = useMatches()
    expect(a.matches.value).toBe(b.matches.value)
    expect(a.status.value).toBe(b.status.value)
    expect(a.sourceName.value).toBe(b.sourceName.value)
  })

  it('exposes the resolved load via __waitForMatchesLoadForTests', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    await __reloadMatchesForTests()
    // After the reload helper resolves, the singleton promise is the
    // same resolved one — awaiting it must not throw or reset state.
    await __waitForMatchesLoadForTests()
    const { status } = useMatches()
    expect(status.value).toBe('ready')
  })
})

describe('useMatches — degraded state (data-source.md §5)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    __resetMatchesForTests()
    __resetClockForTests()
  })

  it("surfaces 'degraded' when build is 'remote' but the winning source isn't 'remote'", async () => {
    // Inject a loader that simulates the chain walker landing on the
    // manual fixture (the worst-tier fallback). Production reaches this
    // state when both remote AND history adapters fail.
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' }),
    )
    await __reloadMatchesForTests()
    const { status, sourceName } = useMatches()
    expect(sourceName.value).toBe('manual')
    expect(status.value).toBe('degraded')
  })

  it("stays 'ready' when build is 'remote' and 'remote' actually won", async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'remote')
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'remote' }),
    )
    await __reloadMatchesForTests()
    const { status } = useMatches()
    expect(status.value).toBe('ready')
  })

  it("stays 'ready' in manual mode even when the source is 'manual'", async () => {
    // The point of 'manual' mode is "the fixture IS the truth", so there's
    // nothing to degrade FROM.
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' }),
    )
    await __reloadMatchesForTests()
    const { status } = useMatches()
    expect(status.value).toBe('ready')
  })
})

describe('useMatches — generatedAt + refresh()', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    __resetMatchesForTests()
    __resetClockForTests()
  })

  it('stamps generatedAt with getNow() on the initial successful load', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    __setClockForTests(() => 1_700_000_000_000)
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' }),
    )
    await __reloadMatchesForTests()
    const { generatedAt } = useMatches()
    expect(generatedAt.value).toBe(1_700_000_000_000)
  })

  it('refresh() re-loads and updates generatedAt to a fresh getNow()', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    let clock = 1_700_000_000_000
    __setClockForTests(() => clock)
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' }),
    )
    await __reloadMatchesForTests()
    const { generatedAt, refresh } = useMatches()
    const first = generatedAt.value
    clock = 1_700_000_060_000 // +60s
    await refresh()
    expect(generatedAt.value).not.toBe(first)
    expect(generatedAt.value).toBe(1_700_000_060_000)
  })

  it('refresh() that returns null preserves prior matches/sourceName/generatedAt (AC-7, AC-8)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    __setClockForTests(() => 1_700_000_000_000)
    let answer: { readonly matches: readonly Match[]; readonly sourceName: string } | null = {
      matches: [SAMPLE_MATCH_A],
      sourceName: 'manual',
    }
    __setChooseSourceForTests(() => Promise.resolve(answer))
    await __reloadMatchesForTests()
    const { matches, sourceName, generatedAt, refresh } = useMatches()
    expect(matches.value).toEqual([SAMPLE_MATCH_A])
    const priorMatches = matches.value
    const priorSource = sourceName.value
    const priorStamp = generatedAt.value
    // Next walk fails: every source threw, walker returns null.
    answer = null
    await refresh()
    expect(matches.value).toBe(priorMatches)
    expect(sourceName.value).toBe(priorSource)
    expect(generatedAt.value).toBe(priorStamp)
  })

  it('refresh() that throws preserves prior state (defensive — same as null path)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    __setClockForTests(() => 1_700_000_000_000)
    let mode: 'ok' | 'throw' = 'ok'
    __setChooseSourceForTests(() => {
      if (mode === 'throw') return Promise.reject(new Error('boom'))
      return Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' })
    })
    await __reloadMatchesForTests()
    const { matches, status, refresh } = useMatches()
    expect(status.value).toBe('ready')
    mode = 'throw'
    await refresh()
    // No flicker to 'error', no clobber of matches.
    expect(matches.value).toEqual([SAMPLE_MATCH_A])
    expect(status.value).toBe('ready')
  })

  it('refresh() that succeeds atomically replaces matches (AC-7)', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    let payload: readonly Match[] = [SAMPLE_MATCH_A]
    __setChooseSourceForTests(() => Promise.resolve({ matches: payload, sourceName: 'manual' }))
    await __reloadMatchesForTests()
    const { matches, refresh } = useMatches()
    expect(matches.value).toEqual([SAMPLE_MATCH_A])
    payload = [SAMPLE_MATCH_A, SAMPLE_MATCH_B]
    await refresh()
    expect(matches.value).toEqual([SAMPLE_MATCH_A, SAMPLE_MATCH_B])
  })

  it('refresh() after a successful initial load does NOT flicker status to "loading"', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    // Use a deferred promise so we can inspect status DURING the refresh.
    let resolveLoad: (value: { matches: readonly Match[]; sourceName: string }) => void = () => {}
    const deferred = new Promise<{ matches: readonly Match[]; sourceName: string }>((res) => {
      resolveLoad = res
    })
    let immediate = true
    __setChooseSourceForTests(() => {
      if (immediate) {
        return Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' })
      }
      return deferred
    })
    await __reloadMatchesForTests()
    const { status, refresh } = useMatches()
    expect(status.value).toBe('ready')

    immediate = false
    const inFlight = refresh()
    // While the second walk is pending, status MUST remain stable.
    expect(status.value).toBe('ready')

    resolveLoad({ matches: [SAMPLE_MATCH_A, SAMPLE_MATCH_B], sourceName: 'manual' })
    await inFlight
    expect(status.value).toBe('ready')
  })
})

describe('useMatches — visibility-change listener', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    __resetMatchesForTests()
    __resetClockForTests()
  })

  it('refresh fires when a synthetic visibilitychange event flips the doc to "visible"', async () => {
    // The singleton listener is attached at module import time. We can't
    // re-attach it per test, but we CAN trigger the real `document` event
    // and observe that `refresh()` ran (via a fresh generatedAt). This
    // pattern beats stubbing `document.addEventListener` because it
    // exercises the actual listener wired up in production code.
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    let clock = 1_700_000_000_000
    __setClockForTests(() => clock)
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' }),
    )
    await __reloadMatchesForTests()
    const { generatedAt } = useMatches()
    const first = generatedAt.value

    // Advance the clock so the next refresh leaves a distinguishable stamp.
    clock = 1_700_000_060_000
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))

    // The listener invokes `void refresh()`. The promise it kicks off
    // resolves on the next microtask since our loader is synchronous-ish.
    // Drain microtasks and then a macrotask to be safe.
    await Promise.resolve()
    await Promise.resolve()
    expect(generatedAt.value).toBe(1_700_000_060_000)
    expect(generatedAt.value).not.toBe(first)
  })

  it('refresh does NOT fire on visibilitychange when state is "hidden"', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    let clock = 1_700_000_000_000
    __setClockForTests(() => clock)
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' }),
    )
    await __reloadMatchesForTests()
    const { generatedAt } = useMatches()
    const first = generatedAt.value

    clock = 1_700_000_060_000
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    await Promise.resolve()
    expect(generatedAt.value).toBe(first)
  })
})

describe('useMatches — __resetMatchesForTests', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    __resetMatchesForTests()
    __resetClockForTests()
  })

  it('returns status to "idle" and clears matches / sourceName / generatedAt', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    __setClockForTests(() => 1_700_000_000_000)
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'manual' }),
    )
    await __reloadMatchesForTests()
    const { status: postLoadStatus } = useMatches()
    expect(postLoadStatus.value).toBe('ready')

    __resetMatchesForTests()
    // Without a re-import (which we can't do — module singleton), we read
    // the same refs again. They MUST have been zeroed by the reset.
    const { matches, status, sourceName, generatedAt } = useMatches()
    expect(status.value).toBe('idle')
    expect(matches.value).toEqual([])
    expect(sourceName.value).toBeNull()
    expect(generatedAt.value).toBeNull()
  })

  it('also clears the injected loader (next __reloadMatchesForTests uses the production default)', async () => {
    // Set up an injected loader that would never resolve to 'manual'.
    vi.stubEnv('VITE_DATA_SOURCE', 'manual')
    __setChooseSourceForTests(() =>
      Promise.resolve({ matches: [SAMPLE_MATCH_A], sourceName: 'wired-test-source' }),
    )
    await __reloadMatchesForTests()
    expect(useMatches().sourceName.value).toBe('wired-test-source')

    __resetMatchesForTests()
    // After reset, the production loader (fixture-backed in CI) should win
    // the chain walk again.
    await __reloadMatchesForTests()
    expect(useMatches().sourceName.value).toBe('manual')
  })

  it('coexists with __parkMatchesAtIdleForTests (existing helper still works)', () => {
    __parkMatchesAtIdleForTests()
    const { status, matches } = useMatches()
    expect(status.value).toBe('idle')
    expect(matches.value).toEqual([])
  })
})
