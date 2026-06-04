// `RemoteSource` is the primary tier of the fallback chain in `remote`
// mode. It fetches the canonical `matches.json` snapshot served from the
// static origin, validates it through `matchListSchema`, and resolves.
//
// Failure semantics: any of network/HTTP/parse/schema failures bubble up
// as a thrown error so that `chooseSource` can advance to the next tier
// (history → manual fixture). The walker treats all throws uniformly.

import { matchListSchema } from '@/matches/domain/match.schema'
import type { MatchSource } from '@/matches/ports/match-source'

// Default URL is relative to the Vite `base` (`/wc-schedule/`) so the
// production build hits `/<base>/data/matches.json`. The dev server
// rewrites the base prefix automatically.
const DEFAULT_REMOTE_URL = '/wc-schedule/data/matches.json'

export function createRemoteSource(url: string = DEFAULT_REMOTE_URL): MatchSource {
  return {
    name: 'remote',
    async load() {
      // `no-store` defeats both the HTTP cache and the service-worker
      // runtime cache for this request. The SW's StaleWhileRevalidate
      // strategy (design.md §9) still ensures last-known data is
      // available through the cache layer; the fetch here always asks
      // the network first when online.
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`remote: ${response.status}`)
      }
      const payload: unknown = await response.json()
      return matchListSchema.parse(payload)
    },
  }
}
