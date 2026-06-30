import type { Match, Stage } from '@/matches/domain/match'

export const BRACKET_ROUND_STAGE = {
  ROUND_OF_32: 'round-of-32',
  ROUND_OF_16: 'round-of-16',
  QUARTER_FINAL: 'quarter-final',
  SEMI_FINAL: 'semi-final',
  THIRD_PLACE: 'third-place',
  FINAL: 'final',
} as const

export type BracketRoundStage = (typeof BRACKET_ROUND_STAGE)[keyof typeof BRACKET_ROUND_STAGE]

export const BRACKET_ROUND_ORDER: readonly BracketRoundStage[] = [
  BRACKET_ROUND_STAGE.ROUND_OF_32,
  BRACKET_ROUND_STAGE.ROUND_OF_16,
  BRACKET_ROUND_STAGE.QUARTER_FINAL,
  BRACKET_ROUND_STAGE.SEMI_FINAL,
  BRACKET_ROUND_STAGE.THIRD_PLACE,
  BRACKET_ROUND_STAGE.FINAL,
]

export const BRACKET_LINEAGE_KIND = {
  WINNER: 'winner',
  LOSER: 'loser',
} as const

export type BracketLineageKind = (typeof BRACKET_LINEAGE_KIND)[keyof typeof BRACKET_LINEAGE_KIND]

export interface BracketLineage {
  readonly kind: BracketLineageKind
  readonly matchId: string
}

export interface BracketMatchViewModel {
  readonly id: string
  readonly stage: BracketRoundStage
  readonly match: Match | null
  readonly sourceA?: BracketLineage
  readonly sourceB?: BracketLineage
}

export interface BracketRoundViewModel {
  readonly stage: BracketRoundStage
  readonly matches: readonly BracketMatchViewModel[]
}

export interface BracketModel {
  readonly rounds: readonly BracketRoundViewModel[]
}

const BRACKET_STAGE_SET: ReadonlySet<BracketRoundStage> = new Set(BRACKET_ROUND_ORDER)

export function isBracketRoundStage(stage: Stage): stage is BracketRoundStage {
  return BRACKET_STAGE_SET.has(stage as BracketRoundStage)
}
