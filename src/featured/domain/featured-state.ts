import type { Match } from '@/matches/domain/match'

export type FeaturedState =
  | { readonly kind: 'live-single'; readonly match: Match }
  | {
      readonly kind: 'live-multiple'
      readonly count: number
      readonly matches: readonly Match[]
    }
  | {
      readonly kind: 'upcoming-today'
      readonly match: Match
      readonly msUntilKickoff: number
    }
  | {
      readonly kind: 'upcoming-future'
      readonly match: Match
      readonly msUntilKickoff: number
    }
  | { readonly kind: 'tournament-over' }

export function assertNever(x: never): never {
  throw new Error(`assertNever: unhandled discriminant ${JSON.stringify(x)}`)
}
