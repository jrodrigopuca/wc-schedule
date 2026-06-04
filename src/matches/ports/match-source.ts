// `MatchSource` is the driven-side port of the hexagonal seam at the data
// boundary. Adapters (RemoteSource, HistorySource, ManualSource) implement
// this interface; the composition root composes them into the fallback
// chain via `chooseSource`.
//
// Contract:
// - `load()` MUST throw on any failure (transport error, parse error,
//   schema mismatch). The walker (`chooseSource`) interprets thrown
//   errors as "this source could not provide data; try the next one".
// - `load()` MUST validate its payload (via `matchListSchema`) BEFORE
//   resolving. The walker does NOT re-validate, to avoid double parsing.
// - `name` is a short, stable identifier used for diagnostics and logging
//   only (e.g. `"remote"`, `"history"`, `"manual"`).

import type { Match } from '@/matches/domain/match'

export interface MatchSource {
  readonly name: string
  load(): Promise<readonly Match[]>
}
