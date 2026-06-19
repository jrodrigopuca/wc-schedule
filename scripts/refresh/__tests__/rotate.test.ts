import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { rotateAndWrite } from '../rotate.ts'
import type { Match } from '../../../src/matches/domain/match.ts'

const matchA: Match = {
  id: 'a1',
  utcKickoff: '2026-06-11T19:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'A',
  teamA: { iso: 'mx', name: 'Mexico' },
  teamB: { iso: 'ca', name: 'Canada' },
}

const matchB: Match = {
  ...matchA,
  id: 'b1',
  status: 'finished',
  score: { home: 1, away: 0 },
}

let dataDir: string
let historyDir: string

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-rotate-'))
  historyDir = path.join(dataDir, 'history')
})

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true })
})

async function readJson(p: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(p, 'utf8'))
}

describe('rotateAndWrite', () => {
  it('first write (no current file) creates matches.json, no history entry', async () => {
    const res = await rotateAndWrite({ dataDir, newPayload: [matchA], prevCommitDate: null })
    expect(res.changed).toBe(true)
    expect(res.historyFile).toBeUndefined()
    expect(await readJson(path.join(dataDir, 'matches.json'))).toEqual([matchA])
  })

  it('identical payload short-circuits to a no-op', async () => {
    await rotateAndWrite({ dataDir, newPayload: [matchA], prevCommitDate: null })
    const res = await rotateAndWrite({
      dataDir,
      newPayload: [matchA],
      prevCommitDate: '2026-06-01',
    })
    expect(res.changed).toBe(false)
    // No history file should have been produced by the no-op.
    const entries = await fs.readdir(historyDir)
    expect(entries.filter((f) => f.startsWith('matches-'))).toHaveLength(0)
  })

  it('new payload rotates current into history and updates the manifest', async () => {
    await rotateAndWrite({ dataDir, newPayload: [matchA], prevCommitDate: null })
    const res = await rotateAndWrite({
      dataDir,
      newPayload: [matchB],
      prevCommitDate: '2026-06-01',
    })

    expect(res.changed).toBe(true)
    expect(res.historyFile).toBe('matches-2026-06-01.json')
    expect(await readJson(path.join(dataDir, 'matches.json'))).toEqual([matchB])
    expect(await readJson(path.join(historyDir, 'matches-2026-06-01.json'))).toEqual([matchA])

    const manifest = (await readJson(path.join(historyDir, 'index.json'))) as {
      version: number
      entries: ReadonlyArray<{ date: string; file: string }>
    }
    expect(manifest.version).toBe(1)
    expect(manifest.entries[0]).toEqual({ date: '2026-06-01', file: 'matches-2026-06-01.json' })
  })

  it('prunes history to the newest 7 snapshots', async () => {
    await fs.mkdir(historyDir, { recursive: true })
    // Seed a current file + 7 existing snapshots (2026-06-01 … 2026-06-07).
    await fs.writeFile(path.join(dataDir, 'matches.json'), JSON.stringify([matchA]), 'utf8')
    for (let d = 1; d <= 7; d++) {
      const day = String(d).padStart(2, '0')
      await fs.writeFile(
        path.join(historyDir, `matches-2026-06-${day}.json`),
        JSON.stringify([matchA]),
        'utf8',
      )
    }

    const res = await rotateAndWrite({
      dataDir,
      newPayload: [matchB],
      prevCommitDate: '2026-06-08',
    })

    // 7 existing + 1 rotated = 8 → oldest (2026-06-01) pruned.
    expect(res.pruned).toEqual(['matches-2026-06-01.json'])
    const snapshots = (await fs.readdir(historyDir)).filter((f) => f.startsWith('matches-')).sort()
    expect(snapshots).toHaveLength(7)
    expect(snapshots).not.toContain('matches-2026-06-01.json')

    const manifest = (await readJson(path.join(historyDir, 'index.json'))) as {
      entries: ReadonlyArray<{ date: string; file: string }>
    }
    expect(manifest.entries).toHaveLength(7)
    expect(manifest.entries[0]?.file).toBe('matches-2026-06-08.json')
  })

  it('two refreshes in the same UTC day overwrite the same-day snapshot', async () => {
    await fs.mkdir(historyDir, { recursive: true })
    // A same-day snapshot already exists from an earlier run today.
    await fs.writeFile(
      path.join(historyDir, 'matches-2026-06-05.json'),
      JSON.stringify([matchB]),
      'utf8',
    )
    await fs.writeFile(path.join(dataDir, 'matches.json'), JSON.stringify([matchA]), 'utf8')

    const res = await rotateAndWrite({
      dataDir,
      newPayload: [matchB],
      prevCommitDate: '2026-06-05',
    })

    expect(res.changed).toBe(true)
    // The current file (matchA) overwrote the earlier same-day snapshot.
    expect(await readJson(path.join(historyDir, 'matches-2026-06-05.json'))).toEqual([matchA])
    const sameDay = (await fs.readdir(historyDir)).filter((f) => f === 'matches-2026-06-05.json')
    expect(sameDay).toHaveLength(1)
  })
})
