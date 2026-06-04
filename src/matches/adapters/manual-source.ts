// `ManualSource` returns the bundled fixture as the match payload. It
// is the LAST tier of the fallback chain in `remote` mode (after remote
// and history) and the ONLY tier in `manual` mode (per data-source.md
// §3.1, §4 and design.md §4.2).
//
// Zero network I/O — the fixture is bundled at build time by Vite. We
// still run it through `matchListSchema` so a future fixture edit that
// drifts from the schema fails loudly in tests, not silently in
// production.

import fixtureJson from '@/shared/fixture/matches.fixture.json'
import { matchListSchema } from '@/matches/domain/match.schema'
import type { MatchSource } from '@/matches/ports/match-source'

export function createManualSource(): MatchSource {
  return {
    name: 'manual',
    load() {
      return Promise.resolve(matchListSchema.parse(fixtureJson))
    },
  }
}
