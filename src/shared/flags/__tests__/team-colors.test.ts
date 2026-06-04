import { describe, expect, it } from 'vitest'
import { FALLBACK_GLOW, TEAM_COLORS, resolveGlow } from '@/shared/flags/team-colors'

describe('resolveGlow', () => {
  it('returns the explicit color for a known ISO code', () => {
    expect(resolveGlow('ar')).toBe(TEAM_COLORS['ar'])
    expect(resolveGlow('br')).toBe(TEAM_COLORS['br'])
    expect(resolveGlow('jp')).toBe(TEAM_COLORS['jp'])
  })

  it('returns FALLBACK_GLOW for an unknown ISO code', () => {
    expect(resolveGlow('zz')).toBe(FALLBACK_GLOW)
  })

  it('returns FALLBACK_GLOW for an ISO that has a flag but no curated color', () => {
    // `gb-eng` is bundled as a flag SVG but isn't in TEAM_COLORS yet — must
    // hit the fallback path, not throw or return undefined.
    expect(resolveGlow('gb-eng')).toBe(FALLBACK_GLOW)
  })

  it('is case-insensitive on input', () => {
    expect(resolveGlow('AR')).toBe(resolveGlow('ar'))
    expect(resolveGlow('Br')).toBe(resolveGlow('br'))
  })
})
