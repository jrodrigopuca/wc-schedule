// Shared `Stage → MessageKey` map. Lifted out of MatchCard and FeaturedCard
// when a third caller (the notification adapter, Phase 9a) needed it.
// Single source of truth — adding a stage value in `domain/match.ts` will
// force a compile-time error here, which cascades to every consumer.

import type { Stage } from '@/matches/domain/match'
import type { MessageKey } from '@/shared/i18n/types'

export const STAGE_KEYS: Record<Stage, MessageKey> = {
  group: 'stage.group',
  'round-of-32': 'stage.roundOf32',
  'round-of-16': 'stage.roundOf16',
  'quarter-final': 'stage.quarterFinal',
  'semi-final': 'stage.semiFinal',
  'third-place': 'stage.thirdPlace',
  final: 'stage.final',
}
