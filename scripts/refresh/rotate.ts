// Backup retention + atomic rotation (design.md §10.2, data-source.md §7).
//
// This is the module that guarantees a refresh NEVER leaves the app worse
// off than before. Every write here happens AFTER validation upstream, and
// the no-change short-circuit makes the cron idempotent within a UTC day.
//
// The 6 steps (per design.md §10.2):
//   1. No-change short-circuit — canonical-hash compare against the current
//      `matches.json`; identical payload → abort, no rotation, no commit.
//   2. Rotate the current file into `history/matches-{prevCommitDate}.json`.
//   3. Write the new payload (sorted by kickoff) as the canonical file.
//   4. Prune `history/` to the newest N=7 snapshots.
//   5. Rewrite `history/index.json` (newest-first manifest).
//   6. Commit — NOT here; the workflow stages `public/data/` atomically.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Match } from '../../src/matches/domain/match.ts'

export const HISTORY_RETENTION = 7

const SNAPSHOT_REGEX = /^matches-(\d{4}-\d{2}-\d{2})\.json$/

export interface RotateResult {
  readonly changed: boolean
  readonly historyFile?: string
  readonly pruned: readonly string[]
}

interface RotateInput {
  readonly dataDir: string
  readonly newPayload: readonly Match[]
  // UTC date (YYYY-MM-DD) of the CURRENT matches.json — used as the history
  // filename when rotating it out. Null when there is no current file yet.
  readonly prevCommitDate: string | null
}

// Deterministic JSON: object keys sorted recursively, no whitespace. Two
// payloads that differ only by key order or formatting hash identically, so
// a re-fetch that produced the same data short-circuits to a no-op.
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeysDeep(obj[key])
    }
    return out
  }
  return value
}

// ISO kickoff strings sort lexicographically === chronologically. Tie-break
// on id so the written order is fully deterministic across runs.
function sortByKickoff(matches: readonly Match[]): Match[] {
  return [...matches].sort((a, b) => {
    if (a.utcKickoff !== b.utcKickoff) return a.utcKickoff < b.utcKickoff ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function readJsonIfExists(p: string): Promise<unknown | null> {
  if (!(await pathExists(p))) return null
  const raw = await fs.readFile(p, 'utf8')
  return JSON.parse(raw)
}

export async function rotateAndWrite(input: RotateInput): Promise<RotateResult> {
  const { dataDir, newPayload, prevCommitDate } = input
  const historyDir = path.join(dataDir, 'history')
  const currentPath = path.join(dataDir, 'matches.json')

  await fs.mkdir(historyDir, { recursive: true })

  const sorted = sortByKickoff(newPayload)

  // Step 1 — no-change short-circuit.
  const current = await readJsonIfExists(currentPath)
  if (current !== null && canonicalize(current) === canonicalize(sorted)) {
    return { changed: false, pruned: [] }
  }

  // Step 2 — rotate the current file into history (only if it exists).
  let historyFile: string | undefined
  if (current !== null) {
    if (prevCommitDate === null) {
      throw new Error('rotate: current matches.json exists but no prevCommitDate was provided')
    }
    historyFile = `matches-${prevCommitDate}.json`
    // `rename` overwrites a same-UTC-day predecessor (two refreshes in one
    // day): chronology stays one-snapshot-per-day. See design.md §10.2.
    await fs.rename(currentPath, path.join(historyDir, historyFile))
  }

  // Step 3 — write the new payload.
  await fs.writeFile(currentPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8')

  // Step 4 — prune history to the newest N.
  const pruned = await pruneHistory(historyDir)

  // Step 5 — rewrite the manifest (newest-first).
  await writeManifest(historyDir)

  return historyFile === undefined
    ? { changed: true, pruned }
    : { changed: true, historyFile, pruned }
}

async function listSnapshots(historyDir: string): Promise<string[]> {
  const entries = await fs.readdir(historyDir)
  // Lexicographic DESC === chronological newest-first (ISO date prefixes).
  return entries
    .filter((f) => SNAPSHOT_REGEX.test(f))
    .sort()
    .reverse()
}

async function pruneHistory(historyDir: string): Promise<string[]> {
  const snapshots = await listSnapshots(historyDir)
  const toPrune = snapshots.slice(HISTORY_RETENTION)
  for (const file of toPrune) {
    await fs.unlink(path.join(historyDir, file))
  }
  return toPrune
}

async function writeManifest(historyDir: string): Promise<void> {
  const snapshots = await listSnapshots(historyDir)
  const manifest = {
    version: 1,
    entries: snapshots.map((file) => {
      const match = SNAPSHOT_REGEX.exec(file)
      // listSnapshots already filtered on the same regex, so this is safe.
      const date = match![1]
      return { date, file }
    }),
  }
  await fs.writeFile(
    path.join(historyDir, 'index.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  )
}
