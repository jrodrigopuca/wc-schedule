// `HistorySource` is the middle tier of the fallback chain. When the
// current `matches.json` is missing or fails validation, the runtime
// reads `history/index.json`, picks the newest entry, and loads that
// snapshot instead. "Yesterday's matches" beats "the bundled fixture
// from last quarter" every time.
//
// Discovery is driven by an explicit manifest because GitHub Pages does
// not expose stable directory indexes (design.md §4.1).

import { matchListSchema } from '@/matches/domain/match.schema'
import { historyManifestSchema } from '@/matches/adapters/history-manifest.schema'
import type { MatchSource } from '@/matches/ports/match-source'

const DEFAULT_HISTORY_BASE_URL = '/wc-schedule/data/history/'

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

export function createHistorySource(baseUrl: string = DEFAULT_HISTORY_BASE_URL): MatchSource {
  const base = ensureTrailingSlash(baseUrl)

  return {
    name: 'history',
    async load() {
      // Step 1: manifest
      const manifestResponse = await fetch(`${base}index.json`, {
        cache: 'no-store',
      })
      if (!manifestResponse.ok) {
        throw new Error(`history: manifest ${manifestResponse.status}`)
      }
      const manifestRaw: unknown = await manifestResponse.json()
      const manifest = historyManifestSchema.parse(manifestRaw)

      // Step 2: newest-first invariant — entries[0] is the latest snapshot
      const newest = manifest.entries[0]
      if (newest === undefined) {
        throw new Error('history: manifest is empty')
      }

      // Step 3: snapshot
      const snapshotResponse = await fetch(`${base}${newest.file}`, {
        cache: 'no-store',
      })
      if (!snapshotResponse.ok) {
        throw new Error(`history: snapshot ${snapshotResponse.status}`)
      }
      const snapshotRaw: unknown = await snapshotResponse.json()
      return matchListSchema.parse(snapshotRaw)
    },
  }
}
