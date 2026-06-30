import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { RefreshMode } from './tournament.ts'

export const REFRESH_REASON = {
  OFF_WINDOW: 'off-window',
  CADENCE_SKIP: 'cadence-skip',
  IDENTICAL_PAYLOAD: 'identical-payload',
  UPDATED_PAYLOAD: 'updated-payload',
  FAILED: 'failed',
} as const

export type RefreshReason = (typeof REFRESH_REASON)[keyof typeof REFRESH_REASON]

export interface RefreshRunReport {
  readonly timestamp: string
  readonly mode: RefreshMode
  readonly lastRefreshDate: string | null
  readonly fetched: boolean
  readonly fetchedCount: number
  readonly changed: boolean
  readonly reason: RefreshReason
  readonly historyFile?: string
  readonly pruned: readonly string[]
  readonly errorMessage?: string
}

interface PersistOptions {
  readonly githubOutputPath?: string
  readonly githubStepSummaryPath?: string
  readonly reportPath?: string
}

export async function persistRefreshReport(
  report: RefreshRunReport,
  options: PersistOptions = readPersistOptions(process.env),
): Promise<void> {
  const writes: Array<Promise<void>> = []

  if (options.reportPath) {
    writes.push(writeTextFile(options.reportPath, JSON.stringify(report, null, 2) + '\n'))
  }

  if (options.githubOutputPath) {
    writes.push(fs.appendFile(options.githubOutputPath, formatRefreshOutputs(report), 'utf8'))
  }

  if (options.githubStepSummaryPath) {
    writes.push(fs.appendFile(options.githubStepSummaryPath, formatRefreshSummary(report), 'utf8'))
  }

  await Promise.all(writes)
}

export function formatRefreshOutputs(report: RefreshRunReport): string {
  const lines = [
    `refresh_mode=${report.mode}`,
    `refresh_fetched=${String(report.fetched)}`,
    `refresh_fetched_count=${String(report.fetchedCount)}`,
    `refresh_changed=${String(report.changed)}`,
    `refresh_reason=${report.reason}`,
    `refresh_last_date=${report.lastRefreshDate ?? 'none'}`,
    `refresh_history_file=${report.historyFile ?? 'none'}`,
    `refresh_pruned_count=${String(report.pruned.length)}`,
  ]

  return lines.join('\n') + '\n'
}

export function formatRefreshSummary(report: RefreshRunReport): string {
  const lines = [
    '## Match refresh report',
    '',
    `- timestamp: \`${report.timestamp}\``,
    `- mode: \`${report.mode}\``,
    `- reason: \`${report.reason}\``,
    `- last successful refresh: ${report.lastRefreshDate === null ? 'none' : `\`${report.lastRefreshDate}\``}`,
    `- fetched upstream: ${report.fetched ? 'yes' : 'no'}`,
    `- matches received: ${report.fetchedCount}`,
    `- changed public/data/matches.json: ${report.changed ? 'yes' : 'no'}`,
    `- rotated history file: ${report.historyFile === undefined ? 'none' : `\`${report.historyFile}\``}`,
    `- pruned snapshots: ${report.pruned.length === 0 ? 'none' : report.pruned.join(', ')}`,
  ]

  if (report.errorMessage !== undefined) {
    lines.push(`- error: ${report.errorMessage}`)
  }

  return lines.join('\n') + '\n\n'
}

function readPersistOptions(env: NodeJS.ProcessEnv): PersistOptions {
  return {
    githubOutputPath: env.GITHUB_OUTPUT,
    githubStepSummaryPath: env.GITHUB_STEP_SUMMARY,
    reportPath: env.REFRESH_REPORT_PATH,
  }
}

async function writeTextFile(filePath: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, text, 'utf8')
}
