// Domain types for matches.
//
// `Team.iso` is the lowercase ISO-3166-1 alpha-2 country code (e.g. "ar",
// "br", "mx"). The lowercase invariant lets us derive flag asset paths and
// team-color lookups with no extra normalization at the call site.

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

export type Stage =
  | 'group'
  | 'round-of-32'
  | 'round-of-16'
  | 'quarter-final'
  | 'semi-final'
  | 'third-place'
  | 'final'

export interface Team {
  readonly iso: string
  readonly name: string
}

export interface Score {
  readonly home: number
  readonly away: number
}

export interface Venue {
  readonly city: string
  readonly country: string
}

export interface Match {
  readonly id: string
  readonly utcKickoff: string
  readonly status: MatchStatus
  readonly stage: Stage
  readonly group?: string
  readonly teamA: Team
  readonly teamB: Team
  readonly score?: Score
  readonly venue?: Venue
}

// Sentinel `iso` for a knockout participant that isn't determined yet (the
// bracket slot is known, the team is not). It passes the schema's
// `/^[a-z]{2}$/` and routes to the neutral `xx.svg` flag + "Por definir"
// label (see `shared/flags/team-colors.ts`, `shared/i18n/country-names.ts`).
export const UNDETERMINED_ISO = 'xx'

// True when either side of the match is still an undetermined bracket slot.
// Such matches render in the list (with a neutral placeholder) but are
// excluded from the featured slot and pre-match notifications — there is no
// real opponent to anticipate yet.
export function hasUndeterminedTeam(match: Match): boolean {
  return match.teamA.iso === UNDETERMINED_ISO || match.teamB.iso === UNDETERMINED_ISO
}
