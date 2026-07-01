// Diagnostic: prints a human-readable snapshot of the current
// public/data/matches.json to $GITHUB_STEP_SUMMARY.
// Run as: node scripts/data-snapshot.cjs
// Used by the refresh workflow to make data state visible after each run.
'use strict'

const fs = require('fs')
const path = require('path')

const summaryPath = process.env.GITHUB_STEP_SUMMARY
const dataPath = path.join(process.cwd(), 'public', 'data', 'matches.json')

let matches
try {
  matches = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
} catch (e) {
  if (summaryPath) {
    fs.appendFileSync(summaryPath, '\n## Data snapshot\n\nCannot read `public/data/matches.json`\n')
  }
  process.exit(0)
}

const finished = matches.filter((m) => m.status === 'finished')
const live = matches.filter((m) => m.status === 'live')
const scheduled = matches.filter((m) => m.status === 'scheduled')

const latest = finished.slice().sort((a, b) => b.utcKickoff.localeCompare(a.utcKickoff))[0]
const score =
  latest && latest.score ? latest.score.home + '-' + latest.score.away : 'no score recorded'
const latestLine = latest
  ? latest.teamA.name +
    ' vs ' +
    latest.teamB.name +
    ' (' +
    latest.utcKickoff.slice(0, 10) +
    ') ' +
    score
  : 'none'

const lines = [
  '',
  '## Data snapshot',
  '',
  '| status | count |',
  '|--------|-------|',
  '| finished | ' + finished.length + ' |',
  '| live | ' + live.length + ' |',
  '| scheduled | ' + scheduled.length + ' |',
  '| **total** | **' + matches.length + '** |',
  '',
  '**Latest finished:** ' + latestLine,
  '',
]

if (summaryPath) {
  fs.appendFileSync(summaryPath, lines.join('\n'))
}

console.log('[data-snapshot] finished=' + finished.length + ' scheduled=' + scheduled.length + ' latest=' + latestLine)
