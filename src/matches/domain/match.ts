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
