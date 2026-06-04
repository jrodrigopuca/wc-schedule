import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __reloadMatchesForTests,
  __waitForMatchesLoadForTests,
  useMatches,
} from '@/matches/composables/useMatches'

describe('useMatches (minimal)', () => {
  beforeEach(() => {
    // happy-dom exposes `fetch`; the RemoteSource hit will fail (no server
    // backing the URL), the HistorySource will fail too, and the chain
    // walker falls through to the bundled fixture. That's the expected
    // path in CI: `sourceName` lands on 'manual'.
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reaches "ready" after the singleton load resolves, with the fixture matches loaded', async () => {
    await __reloadMatchesForTests()
    const { matches, status } = useMatches()
    expect(status.value).toBe('ready')
    expect(matches.value.length).toBeGreaterThan(0)
  })

  it('lands on the manual fixture (sourceName === "manual") in the test environment', async () => {
    await __reloadMatchesForTests()
    const { sourceName } = useMatches()
    expect(sourceName.value).toBe('manual')
  })

  it('is a singleton — every consumer observes the same in-memory matches', async () => {
    await __reloadMatchesForTests()
    const a = useMatches()
    const b = useMatches()
    expect(a.matches.value).toBe(b.matches.value)
    expect(a.status.value).toBe(b.status.value)
    expect(a.sourceName.value).toBe(b.sourceName.value)
  })

  it('exposes the resolved load via __waitForMatchesLoadForTests', async () => {
    await __reloadMatchesForTests()
    // After the reload helper resolves, the singleton promise is the
    // same resolved one — awaiting it must not throw or reset state.
    await __waitForMatchesLoadForTests()
    const { status } = useMatches()
    expect(status.value).toBe('ready')
  })
})
