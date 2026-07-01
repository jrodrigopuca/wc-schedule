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
      // Cache-busting query param guarantees that CDN intermediaries (GitHub
      // Pages / Fastly, Cache-Control: max-age=600) cannot serve a stale
      // snapshot. `no-store` is kept for the browser layer; the unique `_`
      // param handles CDN-level staleness.
      const separator = url.includes('?') ? '&' : '?'
      const bustedUrl = `${url}${separator}_=${Date.now()}`
      const response = await fetch(bustedUrl, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`remote: ${response.status}`)
      }
      const payload: unknown = await response.json()
      return matchListSchema.parse(payload)
    },
  }
}
