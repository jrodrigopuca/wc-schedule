// `useFeatured` is a THIN wrapper around the pure `selectFeaturedState`
// selector. It binds two reactive inputs (the match list and the app-wide
// tick from `useNow`) and exposes a `ComputedRef<FeaturedState>` that
// Vue re-evaluates whenever either input changes.
//
// Why this is so small: every state-transition rule already lives in
// `selectFeaturedState` (specs/featured.md §5, design.md §6). The
// composable's job is ONLY to make the pure function reactive — not to
// own any logic.
//
// Pure function path: NEVER call `Date.now()` here; read time from the
// reactive `now` ref so that fake-timers + `__setClockForTests` produce
// deterministic test output (see conventions in CLAUDE.md).

import { computed, type ComputedRef, type Ref } from 'vue'
import { selectFeaturedState } from '@/featured/domain/select-featured-state'
import type { FeaturedState } from '@/featured/domain/featured-state'
import type { Match } from '@/matches/domain/match'
import { useNow } from '@/shared/time/useNow'

export interface UseFeaturedReturn {
  readonly featured: ComputedRef<FeaturedState>
}

export function useFeatured(matches: Readonly<Ref<readonly Match[]>>): UseFeaturedReturn {
  const { now } = useNow()
  const featured = computed<FeaturedState>(() => selectFeaturedState(matches.value, now.value))
  return { featured }
}
