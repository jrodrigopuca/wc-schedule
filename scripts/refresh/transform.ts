// Pure transform: football-data.org v4 `/competitions/{id}/matches` response
// → the project's `Match[]` shape (design.md §10, tasks T11.2).
//
// This module is PURE (no I/O) so it is unit-testable against a captured
// upstream payload. The network call lives in `fetch.ts`.
//
// SAFETY CONTRACT (data-source.md §7, §10.2): every field is mapped
// STRICTLY. An unknown status enum, stage enum, or — most importantly — a
// team name we cannot resolve to an ISO-3166-1 alpha-2 code throws. A throw
// here aborts the whole refresh BEFORE any rotation, so a surprising upstream
// payload can never overwrite the last-good `matches.json`. Loud failure is
// the feature, not a bug.
//
// ⚠️ VERIFY-AGAINST-LIVE-API: the exact English strings football-data.org
// emits for team names, the set of `status`/`stage` enum values, and the
// `group` encoding are best-effort here. The first real `workflow_dispatch`
// run will surface any mismatch as a hard failure (never as bad data). When
// that happens, correct the maps below — do NOT loosen the strictness.

import type { Match, MatchStatus, Stage } from '../../src/matches/domain/match.ts'
import { UNDETERMINED_ISO } from '../../src/matches/domain/match.ts'

// ── Upstream shape (only the fields we consume) ────────────────────────────

interface UpstreamTeam {
  readonly id: number | null
  readonly name: string | null
  readonly tla?: string | null
}

interface UpstreamScore {
  readonly duration?: string | null
  readonly fullTime?: {
    readonly home?: number | null
    readonly away?: number | null
    readonly homeTeam?: number | null
    readonly awayTeam?: number | null
  }
  readonly regularTime?: {
    readonly home?: number | null
    readonly away?: number | null
    readonly homeTeam?: number | null
    readonly awayTeam?: number | null
  }
  readonly extraTime?: {
    readonly home?: number | null
    readonly away?: number | null
    readonly homeTeam?: number | null
    readonly awayTeam?: number | null
  }
  readonly penalties?: {
    readonly home?: number | null
    readonly away?: number | null
    readonly homeTeam?: number | null
    readonly awayTeam?: number | null
  }
}

interface UpstreamMatch {
  readonly id: number
  readonly utcDate: string
  readonly status: string
  readonly stage: string
  readonly group?: string | null
  readonly homeTeam: UpstreamTeam
  readonly awayTeam: UpstreamTeam
  readonly score?: UpstreamScore
}

export interface UpstreamResponse {
  readonly matches: readonly UpstreamMatch[]
}

// ── Enum maps (upstream → domain) ──────────────────────────────────────────

const STATUS_MAP: Readonly<Record<string, MatchStatus>> = {
  SCHEDULED: 'scheduled',
  TIMED: 'scheduled',
  IN_PLAY: 'live',
  PAUSED: 'live',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
  SUSPENDED: 'cancelled',
  CANCELLED: 'cancelled',
}

const STAGE_MAP: Readonly<Record<string, Stage>> = {
  GROUP_STAGE: 'group',
  LAST_32: 'round-of-32',
  LAST_16: 'round-of-16',
  QUARTER_FINALS: 'quarter-final',
  SEMI_FINALS: 'semi-final',
  THIRD_PLACE: 'third-place',
  FINAL: 'final',
}

// Team display name (as emitted by football-data.org) → ISO-3166-1 alpha-2,
// lowercase (the domain invariant — see match.ts). Covers the 48 WC-2026
// participants plus a few common name variants. Unknown name → throw.
const NAME_TO_ISO: Readonly<Record<string, string>> = {
  Algeria: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Austria: 'at',
  Belgium: 'be',
  'Bosnia-Herzegovina': 'ba',
  Brazil: 'br',
  Cameroon: 'cm',
  Canada: 'ca',
  // football-data emits "Cape Verde Islands"; keep the short form too.
  'Cape Verde Islands': 'cv',
  'Cape Verde': 'cv',
  Colombia: 'co',
  'Costa Rica': 'cr',
  Croatia: 'hr',
  Curaçao: 'cw',
  Curacao: 'cw',
  'Czech Republic': 'cz',
  Czechia: 'cz',
  Denmark: 'dk',
  // football-data emits "Congo DR"; keep the inverted form too.
  'Congo DR': 'cd',
  'DR Congo': 'cd',
  Ecuador: 'ec',
  Egypt: 'eg',
  // 2-letter aliases — the schema's /^[a-z]{2}$/ rejects the canonical
  // `gb-eng`/`gb-sct` subdivision codes (see country-names.ts).
  England: 'gb',
  France: 'fr',
  Germany: 'de',
  Ghana: 'gh',
  Haiti: 'ht',
  Iran: 'ir',
  'IR Iran': 'ir',
  Iraq: 'iq',
  'Ivory Coast': 'ci',
  "Cote d'Ivoire": 'ci',
  Italy: 'it',
  Jamaica: 'jm',
  Japan: 'jp',
  Jordan: 'jo',
  'Korea Republic': 'kr',
  'South Korea': 'kr',
  Mexico: 'mx',
  Morocco: 'ma',
  Netherlands: 'nl',
  'New Zealand': 'nz',
  Norway: 'no',
  Panama: 'pa',
  Paraguay: 'py',
  Portugal: 'pt',
  Qatar: 'qa',
  'Saudi Arabia': 'sa',
  Scotland: 'xs',
  Senegal: 'sn',
  'South Africa': 'za',
  Spain: 'es',
  Sweden: 'se',
  Switzerland: 'ch',
  Tunisia: 'tn',
  Türkiye: 'tr',
  Turkey: 'tr',
  'United States': 'us',
  USA: 'us',
  Uruguay: 'uy',
  Uzbekistan: 'uz',
}

const GROUP_REGEX = /^[A-L]$/

function mapStatus(raw: string): MatchStatus {
  const mapped = STATUS_MAP[raw]
  if (mapped === undefined) {
    throw new Error(`transform: unknown upstream status "${raw}"`)
  }
  return mapped
}

function mapStage(raw: string): Stage {
  const mapped = STAGE_MAP[raw]
  if (mapped === undefined) {
    throw new Error(`transform: unknown upstream stage "${raw}"`)
  }
  return mapped
}

function mapTeam(team: UpstreamTeam): { iso: string; name: string } {
  const name = team.name?.trim()
  // An ABSENT name means the bracket slot exists but the participant is not
  // decided yet (knockout draw pending). Emit the undetermined sentinel
  // instead of throwing — these matches are legitimate, just not yet
  // anticipatable. The client localizes `xx` to "Por definir".
  if (!name) {
    return { iso: UNDETERMINED_ISO, name: 'Por definir' }
  }
  const iso = NAME_TO_ISO[name]
  // A PRESENT-but-unmapped name is a genuine surprise (a participant we
  // haven't catalogued). Throw so the run aborts and the base JSON survives.
  if (iso === undefined) {
    throw new Error(`transform: no ISO mapping for team "${name}" (add it to NAME_TO_ISO)`)
  }
  return { iso, name }
}

// "GROUP_A" → "A". Returns undefined for knockout matches (no group). Throws
// if the group label is present but not in the A–L range the schema allows.
function mapGroup(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined) return undefined
  const letter = raw
    .replace(/^GROUP[_\s-]*/i, '')
    .trim()
    .toUpperCase()
  if (letter === '') return undefined
  if (!GROUP_REGEX.test(letter)) {
    throw new Error(`transform: unexpected group label "${raw}"`)
  }
  return letter
}

// Only emit a score when BOTH sides are concrete non-negative integers
// (finished or in-play matches). football-data leaves them null pre-kickoff.
function mapScore(score: UpstreamScore | undefined): { home: number; away: number } | undefined {
  const duration = score?.duration
  const regularTime = mapScoreLine(score?.regularTime)
  const extraTime = mapScoreLine(score?.extraTime)
  const fullTime = mapScoreLine(score?.fullTime)

  if (duration === 'PENALTY_SHOOTOUT') {
    if (regularTime === undefined) return undefined
    if (extraTime === undefined) return regularTime
    return {
      home: regularTime.home + extraTime.home,
      away: regularTime.away + extraTime.away,
    }
  }

  return fullTime
}

function mapPenalties(
  score: UpstreamScore | undefined,
): { home: number; away: number } | undefined {
  const duration = score?.duration
  if (duration !== 'PENALTY_SHOOTOUT') return undefined

  const regularTime = mapScoreLine(score?.regularTime)
  if (regularTime === undefined) return mapScoreLine(score?.penalties)
  const extraTime = mapScoreLine(score?.extraTime)
  const fullTime = mapScoreLine(score?.fullTime)
  const rawPenalties = mapScoreLine(score?.penalties)
  const baseScore =
    extraTime === undefined
      ? regularTime
      : {
          home: regularTime.home + extraTime.home,
          away: regularTime.away + extraTime.away,
        }

  if (fullTime === undefined) return rawPenalties
  const derivedPenalties = derivePenaltiesFromFullTime(baseScore, fullTime)
  if (derivedPenalties === undefined) return rawPenalties
  if (rawPenalties === undefined) return derivedPenalties
  if (isSameScore(rawPenalties, derivedPenalties)) return rawPenalties
  return derivedPenalties
}

function derivePenaltiesFromFullTime(
  baseScore: { home: number; away: number },
  fullTime: { home: number; away: number },
): { home: number; away: number } | undefined {
  const home = fullTime.home - baseScore.home
  const away = fullTime.away - baseScore.away
  if (home < 0 || away < 0) return undefined
  if (!Number.isInteger(home) || !Number.isInteger(away)) return undefined
  return { home, away }
}

function isSameScore(
  left: { home: number; away: number },
  right: { home: number; away: number },
): boolean {
  return left.home === right.home && left.away === right.away
}

function mapScoreLine(line: UpstreamScore['fullTime']): { home: number; away: number } | undefined {
  if (!line) return undefined
  const home = line.home ?? line.homeTeam
  const away = line.away ?? line.awayTeam
  if (home === null || away === null || home === undefined || away === undefined) return undefined
  return parseScorePair(home, away)
}

function parseScorePair(home: number, away: number): { home: number; away: number } {
  if (home < 0 || away < 0 || !Number.isInteger(home) || !Number.isInteger(away)) {
    throw new Error(`transform: invalid score ${home}-${away}`)
  }
  return { home, away }
}

export function transform(response: UpstreamResponse): Match[] {
  if (!Array.isArray(response.matches)) {
    throw new Error('transform: upstream payload has no `matches` array')
  }

  return response.matches.map((m): Match => {
    const status = mapStatus(m.status)
    const group = mapGroup(m.group)
    // Only FINISHED matches carry a score. football-data updates `fullTime`
    // live, but the daily cadence cannot honestly report an in-flight score
    // and no consumer renders one for a non-finished state (MatchCard shows
    // a score only when finished; the featured slot never does — see
    // featured.md §4.1, data-source.md §6.4). Persisting a live/partial score
    // would just freeze a stale number into the snapshot.
    const score = status === 'finished' ? mapScore(m.score) : undefined
    const penalties = status === 'finished' ? mapPenalties(m.score) : undefined
    return {
      id: `fd-${m.id}`,
      utcKickoff: m.utcDate,
      status,
      stage: mapStage(m.stage),
      teamA: mapTeam(m.homeTeam),
      teamB: mapTeam(m.awayTeam),
      // Spread the optionals only when present — `exactOptionalPropertyTypes`
      // forbids an explicit `undefined` for `?: T` fields.
      ...(group !== undefined ? { group } : {}),
      ...(score !== undefined ? { score } : {}),
      ...(penalties !== undefined ? { penalties } : {}),
    }
  })
}
