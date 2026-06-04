import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'
import { __resetNowForTests, __startNowForTests } from '@/shared/time/useNow'
import { selectFeaturedState } from '@/featured/domain/select-featured-state'
import { useFeatured } from '@/featured/composables/useFeatured'
import type { Match } from '@/matches/domain/match'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm-1',
    utcKickoff: '2026-06-11T20:00:00Z',
    status: 'scheduled',
    stage: 'group',
    group: 'A',
    teamA: { iso: 'mx', name: 'México' },
    teamB: { iso: 'ar', name: 'Argentina' },
    ...overrides,
  }
}

describe('useFeatured', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __resetNowForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetClockForTests()
    __resetNowForTests()
  })

  it('mirrors selectFeaturedState for the same inputs', () => {
    const NOW = Date.parse('2026-06-11T17:00:00Z')
    __setClockForTests(() => NOW)
    __resetNowForTests()

    const m = makeMatch()
    const matches = ref<readonly Match[]>([m])

    const { featured } = useFeatured(matches)
    const expected = selectFeaturedState([m], NOW)
    expect(featured.value).toStrictEqual(expected)
    expect(featured.value.kind).toBe('upcoming-today')
  })

  it('transitions from upcoming-today to live-single when now crosses kickoff', async () => {
    const KICKOFF = Date.parse('2026-06-11T20:00:00Z')
    let clock = KICKOFF - 5_000
    __setClockForTests(() => clock)
    __resetNowForTests()
    __startNowForTests()

    const m = makeMatch({ utcKickoff: '2026-06-11T20:00:00Z' })
    const matches = ref<readonly Match[]>([m])

    const { featured } = useFeatured(matches)
    expect(featured.value.kind).toBe('upcoming-today')

    // Advance past kickoff. One full second elapses, the singleton tick
    // fires, and `useNow` updates the ref that `useFeatured` reads.
    clock = KICKOFF + 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    expect(featured.value.kind).toBe('live-single')
  })

  it('re-evaluates when the matches ref is replaced', () => {
    const NOW = Date.parse('2026-06-11T17:00:00Z')
    __setClockForTests(() => NOW)
    __resetNowForTests()

    const first = makeMatch({ utcKickoff: '2026-06-11T20:00:00Z' })
    const matches = ref<readonly Match[]>([first])

    const { featured } = useFeatured(matches)
    expect(featured.value.kind).toBe('upcoming-today')

    // Wipe the list — selector reports tournament-over (no live, no upcoming).
    matches.value = []
    expect(featured.value.kind).toBe('tournament-over')

    // Re-populate with a future-dated match — selector reports upcoming-future.
    const future = makeMatch({
      id: 'm-future',
      utcKickoff: '2026-07-01T20:00:00Z',
    })
    matches.value = [future]
    expect(featured.value.kind).toBe('upcoming-future')
  })
})
