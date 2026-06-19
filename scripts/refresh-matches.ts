// Refresh orchestrator (design.md §10.3, tasks T11.4).
//
// Run by the daily cron (and `workflow_dispatch`) via `pnpm refresh:matches`:
//
//   getRefreshMode → shouldFetch → fetch → transform → validate → rotate
//
// Every guard short-circuits to a clean exit 0 (workflow succeeds, no diff,
// no commit). Any genuine failure — missing token, upstream error, transform
// surprise, schema violation — exits NON-ZERO so the workflow fails LOUDLY
// and the previous `matches.json` + history are left untouched
// (data-source.md §7, AC-18). The base JSON is never the casualty of a bad
// run.
//
// Executed directly as TypeScript by Node's type stripping (the repo
// standard — see tsconfig.node.json `erasableSyntaxOnly`). No build step.

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getRefreshMode, shouldFetch, utcDateOf, utcMidnight } from './refresh/window.ts'
import { fetchMatches } from './refresh/fetch.ts'
import { rotateAndWrite } from './refresh/rotate.ts'
import { matchListSchema } from '../src/matches/domain/match.schema.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(REPO_ROOT, 'public', 'data')
const MATCHES_REL = 'public/data/matches.json'

function log(message: string): void {
  console.log(`[refresh] ${message}`)
}

// UTC date (YYYY-MM-DD) of the last commit that touched matches.json, or null
// if the file has no history yet (first-ever run). No sidecar file — the git
// log IS the "last refreshed at" record (design.md §10.1).
function readLastCommitUtcDate(): string | null {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', MATCHES_REL], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim()
    return out === '' ? null : out.slice(0, 10)
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const now = Date.now()
  const mode = getRefreshMode(now)

  if (mode === 'off') {
    log('outside tournament windows — no-op')
    return
  }

  const lastDate = readLastCommitUtcDate()
  const lastRefreshMs = lastDate === null ? null : utcMidnight(lastDate)
  const todayMs = utcDateOf(now)

  if (!shouldFetch(mode, todayMs, lastRefreshMs)) {
    log(`mode=${mode}: already refreshed within cadence (last=${lastDate}) — no-op`)
    return
  }

  log(`mode=${mode}: fetching upstream…`)
  const transformed = await fetchMatches()

  // Same schema the CLIENT trusts. A violation throws → non-zero exit →
  // workflow fails → no rotation, no commit.
  const validated = matchListSchema.parse(transformed)
  log(`fetched + validated ${validated.length} matches`)

  // History filename uses the PREVIOUS commit's UTC date (the data that was
  // live). Fall back to today only if the current file is untracked.
  const prevCommitDate = lastDate ?? utcDateOnly(now)

  const result = await rotateAndWrite({
    dataDir: DATA_DIR,
    newPayload: validated,
    prevCommitDate,
  })

  if (!result.changed) {
    log('payload identical to current matches.json — no rotation, no commit')
    return
  }

  log(
    `rotated: wrote matches.json` +
      (result.historyFile ? `, archived ${result.historyFile}` : '') +
      (result.pruned.length > 0 ? `, pruned ${result.pruned.join(', ')}` : ''),
  )
}

function utcDateOnly(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

main().catch((err: unknown) => {
  console.error('[refresh] FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
