import { describe, expect, it } from 'vitest'
import { COUNTRY_NAMES } from '@/shared/i18n/country-names'

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

describe('COUNTRY_NAMES', () => {
  it('covers every flag asset with an ES entry', () => {
    const isos = isoCodesFromFlags()
    expect(isos.length).toBeGreaterThan(0)
    const missing: string[] = []
    for (const iso of isos) {
      if (COUNTRY_NAMES.es[iso] === undefined) missing.push(iso)
    }
    expect(missing, `Missing ES country name for: ${missing.join(', ')}`).toEqual([])
  })

  it('provides an EN entry for every ES entry', () => {
    const missing: string[] = []
    for (const iso of Object.keys(COUNTRY_NAMES.es)) {
      if (COUNTRY_NAMES.en[iso] === undefined) missing.push(iso)
    }
    expect(missing, `Missing EN country name for: ${missing.join(', ')}`).toEqual([])
  })

  it('keys are lowercase to allow case-insensitive lookups via toLowerCase()', () => {
    const offenders: string[] = []
    for (const iso of Object.keys(COUNTRY_NAMES.es)) {
      if (iso !== iso.toLowerCase()) offenders.push(iso)
    }
    expect(offenders).toEqual([])
  })
})
