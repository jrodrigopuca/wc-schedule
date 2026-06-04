// Composition root for the data layer. Given the build-time environment,
// returns the ordered list of `MatchSource` adapters that `chooseSource`
// will walk at runtime.
//
// Wiring rules (data-source.md §3, design.md §4.2):
// - `VITE_DATA_SOURCE === "manual"` → fixture-only. NO network I/O,
//   NO history lookup. This mode exists for offline-first authoring and
//   demos and MUST NOT silently fall back to remote sources.
// - Default (`"remote"`) → full chain: `[remote, history, manual]`.
//   Each tier is independently validated; the walker advances past any
//   tier that throws.
//
// This file is the COMPOSITION ROOT for the data layer. Phase 10 (T10.2)
// is responsible for wiring this into `main.ts` and the running app.

import { createHistorySource } from '@/matches/adapters/history-source'
import { createManualSource } from '@/matches/adapters/manual-source'
import { createRemoteSource } from '@/matches/adapters/remote-source'
import type { MatchSource } from '@/matches/ports/match-source'

export function createMatchSourceChain(env: ImportMetaEnv): readonly MatchSource[] {
  if (env.VITE_DATA_SOURCE === 'manual') {
    return [createManualSource()]
  }
  return [createRemoteSource(), createHistorySource(), createManualSource()]
}
