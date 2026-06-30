// Three-letter team codes (FIFA-style, e.g. "BRA", "JPN") keyed by the
// lowercase ISO-3166-1 alpha-2 used across the app (plus the `xs` alias for
// Scotland). These are NOT locale-dependent — the same code renders in every
// language — so they live outside the `MESSAGES` table.
//
// Why a static map instead of the upstream `tla`: football-data DOES emit a
// `tla`, but `transform.ts` drops it, so the client never receives it. Rather
// than a data-model migration (Team gaining `tla` + schema + a full data
// regen) we keep a small static map here, mirroring the `country-names.ts`
// convention. `resolveCode3` is the single seam the UI uses, so swapping the
// source for upstream `tla` later is a one-function change with no UI churn.
//
// Coverage: the 48 WC-2026 participants plus the extra group-stage flags that
// have a `country-names.ts` entry. Anything missing falls back at the call
// site to `iso.toUpperCase()` (a 2-letter code is an acceptable degrade).

const CODE3: Readonly<Record<string, string>> = {
  ar: 'ARG',
  at: 'AUT',
  au: 'AUS',
  ba: 'BIH',
  be: 'BEL',
  br: 'BRA',
  ca: 'CAN',
  cd: 'COD',
  ch: 'SUI',
  ci: 'CIV',
  cl: 'CHI',
  cm: 'CMR',
  cn: 'CHN',
  co: 'COL',
  cr: 'CRC',
  cv: 'CPV',
  cw: 'CUW',
  cz: 'CZE',
  de: 'GER',
  dk: 'DEN',
  dz: 'ALG',
  ec: 'ECU',
  eg: 'EGY',
  es: 'ESP',
  fr: 'FRA',
  gb: 'ENG',
  gh: 'GHA',
  hn: 'HON',
  hr: 'CRO',
  ht: 'HAI',
  iq: 'IRQ',
  ir: 'IRN',
  it: 'ITA',
  jm: 'JAM',
  jo: 'JOR',
  jp: 'JPN',
  kr: 'KOR',
  ma: 'MAR',
  mx: 'MEX',
  ng: 'NGA',
  nl: 'NED',
  no: 'NOR',
  nz: 'NZL',
  pa: 'PAN',
  pl: 'POL',
  pt: 'POR',
  py: 'PAR',
  qa: 'QAT',
  rs: 'SRB',
  sa: 'KSA',
  se: 'SWE',
  sn: 'SEN',
  tn: 'TUN',
  tr: 'TUR',
  us: 'USA',
  uy: 'URU',
  uz: 'UZB',
  ve: 'VEN',
  xs: 'SCO',
  ye: 'YEM',
  za: 'RSA',
}

// Returns the FIFA-style three-letter code for a team ISO, or `null` when we
// have no mapping (caller decides the fallback — typically `iso.toUpperCase()`).
// The `xx` undetermined-slot sentinel intentionally has no code.
export function resolveCode3(iso: string): string | null {
  return CODE3[iso] ?? null
}
