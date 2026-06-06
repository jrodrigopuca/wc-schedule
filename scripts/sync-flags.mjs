#!/usr/bin/env node
// Copies a curated subset of circle-flags SVGs into src/shared/flags/.
//
// The list below is the union of:
//   - every ISO-alpha-2 code present in src/shared/fixture/matches.fixture.json
//   - the broader set of likely FIFA World Cup 2026 participants
//
// Idempotent: running this script repeatedly produces the same result.
// Re-run via `pnpm run flags:sync` after editing the FLAG_ISOS list.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SOURCE_DIR = path.join(REPO_ROOT, 'node_modules', 'circle-flags', 'flags')
const TARGET_DIR = path.join(REPO_ROOT, 'src', 'shared', 'flags')

// Curated shortlist. Lowercase ISO-alpha-2 only.
// First: every code present in the bundled fixture as of 2026-06-04.
// Then: additional likely WC-2026 participants (host nations are already in
// the fixture; this fills out probable qualifiers across confederations).
const FLAG_ISOS = [
  // ── In current fixture ───────────────────────────────────────────────────
  'ar', 'au', 'be', 'br', 'ca', 'ch', 'ci', 'cl', 'cm', 'co', 'cr', 'cv',
  'cz', 'de', 'dz', 'ec', 'eg', 'es', 'fr', 'gh', 'hn', 'iq', 'ir', 'it',
  'jo', 'jp', 'kr', 'ma', 'mx', 'ng', 'nl', 'no', 'nz', 'pa', 'pl', 'pt',
  'py', 'qa', 'sa', 'sn', 'tn', 'tr', 'us', 'uy', 'uz', 've', 'ye', 'za',
  // ── Likely WC-2026 participants not yet in the fixture ───────────────────
  'cd', 'cn', 'dk', 'gb', 'gb-eng', 'gb-sct', 'gb-wls', 'hr', 'jm', 'rs',
  // ── Real WC-2026 qualifiers added after the December 2025 draw ───────────
  'at', 'ba', 'cw', 'ht', 'se',
]

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await pathExists(SOURCE_DIR))) {
    console.error(
      `[sync-flags] circle-flags package not installed. Run: pnpm add -D circle-flags`,
    )
    process.exit(1)
  }

  await fs.mkdir(TARGET_DIR, { recursive: true })

  const seen = new Set()
  const missing = []
  const copied = []
  const skipped = []

  for (const iso of FLAG_ISOS) {
    if (seen.has(iso)) continue
    seen.add(iso)

    const src = path.join(SOURCE_DIR, `${iso}.svg`)
    const dst = path.join(TARGET_DIR, `${iso}.svg`)

    if (!(await pathExists(src))) {
      missing.push(iso)
      continue
    }

    const srcBytes = await fs.readFile(src)
    if (await pathExists(dst)) {
      const dstBytes = await fs.readFile(dst)
      if (srcBytes.equals(dstBytes)) {
        skipped.push(iso)
        continue
      }
    }
    await fs.writeFile(dst, srcBytes)
    copied.push(iso)
  }

  // LICENSE attribution (verbatim from upstream).
  const upstreamLicense = path.join(
    REPO_ROOT,
    'node_modules',
    'circle-flags',
    'LICENSE.md',
  )
  if (await pathExists(upstreamLicense)) {
    const licenseText = await fs.readFile(upstreamLicense, 'utf8')
    const header = [
      '# Circle Flags — license',
      '',
      'The SVG files in this directory are copied verbatim from the',
      '`circle-flags` package by HatScripts and remain under the MIT',
      'License reproduced below.',
      '',
      'Upstream: https://github.com/HatScripts/circle-flags',
      '',
      '---',
      '',
    ].join('\n')
    await fs.writeFile(path.join(TARGET_DIR, 'LICENSE'), header + licenseText)
  }

  // Remove the original .gitkeep — the folder now has real content.
  const gitkeep = path.join(TARGET_DIR, '.gitkeep')
  if (await pathExists(gitkeep)) await fs.unlink(gitkeep)

  console.log(
    `[sync-flags] copied=${copied.length} skipped(unchanged)=${skipped.length} missing=${missing.length}`,
  )
  if (missing.length > 0) {
    console.warn(`[sync-flags] missing from upstream: ${missing.join(', ')}`)
  }
}

main().catch((err) => {
  console.error('[sync-flags] failed:', err)
  process.exit(1)
})
