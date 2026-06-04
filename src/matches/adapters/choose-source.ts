// `chooseSource` walks an ordered list of `MatchSource` adapters and
// returns the first valid payload. If every source throws, returns `null`
// and lets the caller decide whether to render an error state.
//
// Per design.md §4.2 the walker does NOT validate — each source is
// responsible for parsing its own payload through `matchListSchema`
// before resolving. Double-parsing the same payload would burn CPU for
// no benefit.

import type { Match } from '@/matches/domain/match'
import type { MatchSource } from '@/matches/ports/match-source'

export interface ChosenSource {
  readonly matches: readonly Match[]
  readonly sourceName: string
}

export async function chooseSource(sources: readonly MatchSource[]): Promise<ChosenSource | null> {
  for (const source of sources) {
    try {
      const matches = await source.load()
      return { matches, sourceName: source.name }
    } catch {
      // This source could not deliver; try the next one. Diagnostics are
      // the source's responsibility, not the walker's.
      continue
    }
  }
  return null
}
