import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  formatRefreshOutputs,
  formatRefreshSummary,
  persistRefreshReport,
  REFRESH_REASON,
  type RefreshRunReport,
} from '../report.ts'

const report: RefreshRunReport = {
  timestamp: '2026-06-29T12:00:00.000Z',
  mode: 'tournament',
  lastRefreshDate: '2026-06-28',
  fetched: true,
  fetchedCount: 104,
  changed: true,
  reason: REFRESH_REASON.UPDATED_PAYLOAD,
  historyFile: 'matches-2026-06-28.json',
  pruned: ['matches-2026-06-20.json'],
}

let tempDir: string | null = null

afterEach(async () => {
  if (tempDir !== null) {
    await fs.rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('refresh report helpers', () => {
  it('formats GitHub Action outputs with a machine-readable payload', () => {
    expect(formatRefreshOutputs(report)).toContain('refresh_mode=tournament')
    expect(formatRefreshOutputs(report)).toContain('refresh_changed=true')
    expect(formatRefreshOutputs(report)).toContain('refresh_fetched_count=104')
  })

  it('formats a human-readable job summary', () => {
    const summary = formatRefreshSummary(report)
    expect(summary).toContain('## Match refresh report')
    expect(summary).toContain('- fetched upstream: yes')
    expect(summary).toContain('matches-2026-06-28.json')
  })

  it('persists the JSON report plus GitHub metadata files when paths are provided', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-refresh-report-'))
    const reportPath = path.join(tempDir, 'artifacts', 'refresh-report.json')
    const outputPath = path.join(tempDir, 'github-output.txt')
    const summaryPath = path.join(tempDir, 'github-summary.md')

    await persistRefreshReport(report, {
      reportPath,
      githubOutputPath: outputPath,
      githubStepSummaryPath: summaryPath,
    })

    expect(JSON.parse(await fs.readFile(reportPath, 'utf8'))).toEqual(report)
    expect(await fs.readFile(outputPath, 'utf8')).toContain('refresh_reason=updated-payload')
    expect(await fs.readFile(summaryPath, 'utf8')).toContain('Match refresh report')
  })
})
