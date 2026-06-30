import type { Match } from '@/matches/domain/match'
import {
  BRACKET_LINEAGE_KIND,
  BRACKET_ROUND_ORDER,
  BRACKET_ROUND_STAGE,
  isBracketRoundStage,
  type BracketLineage,
  type BracketMatchViewModel,
  type BracketModel,
  type BracketRoundStage,
} from './bracket'

interface BracketTopologyMatch {
  readonly id: string
  readonly stage: BracketRoundStage
  readonly sourceA?: BracketLineage
  readonly sourceB?: BracketLineage
}

const winnerOf = (matchId: string): BracketLineage => ({
  kind: BRACKET_LINEAGE_KIND.WINNER,
  matchId,
})

const loserOf = (matchId: string): BracketLineage => ({ kind: BRACKET_LINEAGE_KIND.LOSER, matchId })

const BRACKET_TOPOLOGY: Readonly<Record<BracketRoundStage, readonly BracketTopologyMatch[]>> = {
  'round-of-32': [
    { id: 'wc2026-r32-01', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-02', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-03', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-04', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-05', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-06', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-07', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-08', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-09', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-10', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-11', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-12', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-13', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-14', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-15', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
    { id: 'wc2026-r32-16', stage: BRACKET_ROUND_STAGE.ROUND_OF_32 },
  ],
  'round-of-16': [
    {
      id: 'wc2026-r16-01',
      stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
      sourceA: winnerOf('wc2026-r32-01'),
      sourceB: winnerOf('wc2026-r32-04'),
    },
    {
      id: 'wc2026-r16-02',
      stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
      sourceA: winnerOf('wc2026-r32-03'),
      sourceB: winnerOf('wc2026-r32-06'),
    },
    {
      id: 'wc2026-r16-03',
      stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
      sourceA: winnerOf('wc2026-r32-02'),
      sourceB: winnerOf('wc2026-r32-05'),
    },
    {
      id: 'wc2026-r16-04',
      stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
      sourceA: winnerOf('wc2026-r32-07'),
      sourceB: winnerOf('wc2026-r32-08'),
    },
    {
      id: 'wc2026-r16-05',
      stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
      sourceA: winnerOf('wc2026-r32-12'),
      sourceB: winnerOf('wc2026-r32-11'),
    },
    {
      id: 'wc2026-r16-06',
      stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
      sourceA: winnerOf('wc2026-r32-09'),
      sourceB: winnerOf('wc2026-r32-10'),
    },
    {
      id: 'wc2026-r16-07',
      stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
      sourceA: winnerOf('wc2026-r32-15'),
      sourceB: winnerOf('wc2026-r32-14'),
    },
    {
      id: 'wc2026-r16-08',
      stage: BRACKET_ROUND_STAGE.ROUND_OF_16,
      sourceA: winnerOf('wc2026-r32-13'),
      sourceB: winnerOf('wc2026-r32-16'),
    },
  ],
  'quarter-final': [
    {
      id: 'wc2026-qf-01',
      stage: BRACKET_ROUND_STAGE.QUARTER_FINAL,
      sourceA: winnerOf('wc2026-r16-01'),
      sourceB: winnerOf('wc2026-r16-02'),
    },
    {
      id: 'wc2026-qf-02',
      stage: BRACKET_ROUND_STAGE.QUARTER_FINAL,
      sourceA: winnerOf('wc2026-r16-05'),
      sourceB: winnerOf('wc2026-r16-06'),
    },
    {
      id: 'wc2026-qf-03',
      stage: BRACKET_ROUND_STAGE.QUARTER_FINAL,
      sourceA: winnerOf('wc2026-r16-03'),
      sourceB: winnerOf('wc2026-r16-04'),
    },
    {
      id: 'wc2026-qf-04',
      stage: BRACKET_ROUND_STAGE.QUARTER_FINAL,
      sourceA: winnerOf('wc2026-r16-07'),
      sourceB: winnerOf('wc2026-r16-08'),
    },
  ],
  'semi-final': [
    {
      id: 'wc2026-sf-01',
      stage: BRACKET_ROUND_STAGE.SEMI_FINAL,
      sourceA: winnerOf('wc2026-qf-01'),
      sourceB: winnerOf('wc2026-qf-02'),
    },
    {
      id: 'wc2026-sf-02',
      stage: BRACKET_ROUND_STAGE.SEMI_FINAL,
      sourceA: winnerOf('wc2026-qf-03'),
      sourceB: winnerOf('wc2026-qf-04'),
    },
  ],
  'third-place': [
    {
      id: 'wc2026-3rd',
      stage: BRACKET_ROUND_STAGE.THIRD_PLACE,
      sourceA: loserOf('wc2026-sf-01'),
      sourceB: loserOf('wc2026-sf-02'),
    },
  ],
  final: [
    {
      id: 'wc2026-final',
      stage: BRACKET_ROUND_STAGE.FINAL,
      sourceA: winnerOf('wc2026-sf-01'),
      sourceB: winnerOf('wc2026-sf-02'),
    },
  ],
}

export function buildBracketModel(matches: readonly Match[]): BracketModel {
  const knockoutMatchesByStage = groupKnockoutMatchesByStage(matches)
  return {
    rounds: BRACKET_ROUND_ORDER.map((stage) => ({
      stage,
      matches: BRACKET_TOPOLOGY[stage].map((topologyMatch, index) =>
        toBracketMatchViewModel(topologyMatch, knockoutMatchesByStage[stage][index] ?? null),
      ),
    })),
  }
}

function groupKnockoutMatchesByStage(
  matches: readonly Match[],
): Readonly<Record<BracketRoundStage, readonly Match[]>> {
  const grouped: Record<BracketRoundStage, Match[]> = {
    'round-of-32': [],
    'round-of-16': [],
    'quarter-final': [],
    'semi-final': [],
    'third-place': [],
    final: [],
  }

  for (const match of matches) {
    if (!isBracketRoundStage(match.stage)) continue
    grouped[match.stage].push(match)
  }

  return {
    'round-of-32': sortBracketStageMatches(grouped['round-of-32']),
    'round-of-16': sortBracketStageMatches(grouped['round-of-16']),
    'quarter-final': sortBracketStageMatches(grouped['quarter-final']),
    'semi-final': sortBracketStageMatches(grouped['semi-final']),
    'third-place': sortBracketStageMatches(grouped['third-place']),
    final: sortBracketStageMatches(grouped.final),
  }
}

function sortBracketStageMatches(matches: readonly Match[]): readonly Match[] {
  return [...matches].sort((left, right) => {
    const kickoffDelta = Date.parse(left.utcKickoff) - Date.parse(right.utcKickoff)
    if (kickoffDelta !== 0) return kickoffDelta
    return left.id.localeCompare(right.id)
  })
}

function toBracketMatchViewModel(
  topologyMatch: BracketTopologyMatch,
  match: Match | null,
): BracketMatchViewModel {
  return {
    id: topologyMatch.id,
    stage: topologyMatch.stage,
    match,
    ...(topologyMatch.sourceA ? { sourceA: topologyMatch.sourceA } : {}),
    ...(topologyMatch.sourceB ? { sourceB: topologyMatch.sourceB } : {}),
  }
}
