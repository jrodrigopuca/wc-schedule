import { describe, expect, it } from 'vitest'
import { FALLBACK_GLOW, TEAM_COLORS, resolveGlow } from '@/shared/flags/team-colors'

// Enumerate flag assets via Vite's glob so we don't need node:fs in this test
// (the file lives under src/ and is type-checked by tsconfig.app.json, which
// does NOT include Node types).
const flagModules = import.meta.glob('@/shared/flags/*.svg', { eager: false })

function isoCodesFromFlags(): readonly string[] {
  return Object.keys(flagModules)
    .map((path) => {
      const file = path.split('/').pop() ?? ''
      return file.replace(/\.svg$/, '').toLowerCase()
    })
    .filter((iso) => iso.length > 0)
}

describe('resolveGlow', () => {
  it('returns the explicit color for a known ISO code', () => {
    expect(resolveGlow('ar')).toBe(TEAM_COLORS['ar'])
    expect(resolveGlow('br')).toBe(TEAM_COLORS['br'])
    expect(resolveGlow('jp')).toBe(TEAM_COLORS['jp'])
  })

  it('returns FALLBACK_GLOW for an unknown ISO code', () => {
    expect(resolveGlow('zz')).toBe(FALLBACK_GLOW)
  })

  it('is case-insensitive on input', () => {
    expect(resolveGlow('AR')).toBe(resolveGlow('ar'))
    expect(resolveGlow('Br')).toBe(resolveGlow('br'))
  })
})

describe('TEAM_COLORS coverage', () => {
  it('covers every bundled flag with a curated color', () => {
    const isos = isoCodesFromFlags()
    expect(isos.length).toBeGreaterThan(0)
    const missing: string[] = []
    for (const iso of isos) {
      if (TEAM_COLORS[iso] === undefined) missing.push(iso)
    }
    expect(missing, `Missing TEAM_COLORS entry for: ${missing.join(', ')}`).toEqual([])
  })

  it('all entries are valid hex colors', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/
    const offenders: string[] = []
    for (const [iso, color] of Object.entries(TEAM_COLORS)) {
      if (!hexRegex.test(color)) offenders.push(`${iso}=${color}`)
    }
    expect(offenders).toEqual([])
  })
})
