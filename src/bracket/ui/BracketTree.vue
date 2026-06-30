<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/shared/i18n/useI18n'
import type {
  BracketMatchViewModel,
  BracketModel,
  BracketRoundStage,
} from '@/bracket/domain/bracket'
import { BRACKET_ROUND_STAGE } from '@/bracket/domain/bracket'
import BracketNode from './BracketNode.vue'

interface BracketTrackSlotViewModel {
  readonly rowStart: number
  readonly connectorSpan: number
  readonly hasIncomingConnector: boolean
  readonly hasOutgoingConnector: boolean
  readonly roundMatch: BracketMatchViewModel
}

interface BracketTrackViewModel {
  readonly stage: BracketRoundStage
  readonly label: string
  readonly slots: readonly BracketTrackSlotViewModel[]
}

interface BracketTrackLayout {
  readonly rowStarts: readonly number[]
  readonly connectorSpan: number
}

const props = defineProps<{
  model: BracketModel
  now: number
}>()

const { t } = useI18n()

const BRACKET_STAGE_LABEL: Readonly<Record<BracketRoundStage, string>> = {
  [BRACKET_ROUND_STAGE.ROUND_OF_32]: 'bracket.stage.roundOf32',
  [BRACKET_ROUND_STAGE.ROUND_OF_16]: 'bracket.stage.roundOf16',
  [BRACKET_ROUND_STAGE.QUARTER_FINAL]: 'bracket.stage.quarterFinal',
  [BRACKET_ROUND_STAGE.SEMI_FINAL]: 'bracket.stage.semiFinal',
  [BRACKET_ROUND_STAGE.THIRD_PLACE]: 'bracket.stage.thirdPlace',
  [BRACKET_ROUND_STAGE.FINAL]: 'bracket.stage.final',
}

const BRACKET_MAIN_STAGE_ORDER = [
  BRACKET_ROUND_STAGE.ROUND_OF_32,
  BRACKET_ROUND_STAGE.ROUND_OF_16,
  BRACKET_ROUND_STAGE.QUARTER_FINAL,
  BRACKET_ROUND_STAGE.SEMI_FINAL,
] as const

const BRACKET_STAGE_LAYOUT: Readonly<Record<BracketRoundStage, BracketTrackLayout>> = {
  [BRACKET_ROUND_STAGE.ROUND_OF_32]: {
    rowStarts: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31],
    connectorSpan: 0,
  },
  [BRACKET_ROUND_STAGE.ROUND_OF_16]: {
    rowStarts: [2, 6, 10, 14, 18, 22, 26, 30],
    connectorSpan: 2,
  },
  [BRACKET_ROUND_STAGE.QUARTER_FINAL]: {
    rowStarts: [4, 12, 20, 28],
    connectorSpan: 4,
  },
  [BRACKET_ROUND_STAGE.SEMI_FINAL]: {
    rowStarts: [8, 24],
    connectorSpan: 8,
  },
  [BRACKET_ROUND_STAGE.FINAL]: {
    rowStarts: [16],
    connectorSpan: 16,
  },
  [BRACKET_ROUND_STAGE.THIRD_PLACE]: {
    rowStarts: [26],
    connectorSpan: 0,
  },
}

const BRACKET_STAGE_DISPLAY_ORDER: Readonly<Record<BracketRoundStage, readonly string[]>> = {
  [BRACKET_ROUND_STAGE.ROUND_OF_32]: [
    'wc2026-r32-01',
    'wc2026-r32-04',
    'wc2026-r32-03',
    'wc2026-r32-06',
    'wc2026-r32-12',
    'wc2026-r32-11',
    'wc2026-r32-09',
    'wc2026-r32-10',
    'wc2026-r32-02',
    'wc2026-r32-05',
    'wc2026-r32-07',
    'wc2026-r32-08',
    'wc2026-r32-15',
    'wc2026-r32-14',
    'wc2026-r32-13',
    'wc2026-r32-16',
  ],
  [BRACKET_ROUND_STAGE.ROUND_OF_16]: [
    'wc2026-r16-01',
    'wc2026-r16-02',
    'wc2026-r16-05',
    'wc2026-r16-06',
    'wc2026-r16-03',
    'wc2026-r16-04',
    'wc2026-r16-07',
    'wc2026-r16-08',
  ],
  [BRACKET_ROUND_STAGE.QUARTER_FINAL]: [
    'wc2026-qf-01',
    'wc2026-qf-02',
    'wc2026-qf-03',
    'wc2026-qf-04',
  ],
  [BRACKET_ROUND_STAGE.SEMI_FINAL]: ['wc2026-sf-01', 'wc2026-sf-02'],
  [BRACKET_ROUND_STAGE.FINAL]: ['wc2026-final'],
  [BRACKET_ROUND_STAGE.THIRD_PLACE]: ['wc2026-3rd'],
}

const roundsByStage = computed(
  () => new Map(props.model.rounds.map((round) => [round.stage, round] as const)),
)

const mainTracks = computed(() => BRACKET_MAIN_STAGE_ORDER.map((stage) => buildTrack(stage)))

const terminalTracks = computed(() => [
  buildTrack(BRACKET_ROUND_STAGE.FINAL),
  buildTrack(BRACKET_ROUND_STAGE.THIRD_PLACE),
])

function buildTrack(stage: BracketRoundStage): BracketTrackViewModel {
  const round = roundsByStage.value.get(stage)
  const rowStarts = BRACKET_STAGE_LAYOUT[stage].rowStarts
  const roundMatches = new Map(round?.matches.map((match) => [match.id, match] as const) ?? [])

  return {
    stage,
    label: t(BRACKET_STAGE_LABEL[stage]),
    slots: BRACKET_STAGE_DISPLAY_ORDER[stage].flatMap((matchId, index) => {
      const roundMatch = roundMatches.get(matchId)
      if (roundMatch === undefined) return []

      return [
        {
          rowStart: rowStarts[index] ?? 1,
          connectorSpan: BRACKET_STAGE_LAYOUT[stage].connectorSpan,
          hasIncomingConnector:
            roundMatch.sourceA !== undefined || roundMatch.sourceB !== undefined,
          hasOutgoingConnector:
            stage !== BRACKET_ROUND_STAGE.FINAL && stage !== BRACKET_ROUND_STAGE.THIRD_PLACE,
          roundMatch,
        },
      ]
    }),
  }
}

function slotStyle(slot: BracketTrackSlotViewModel): Readonly<Record<string, string>> {
  return {
    '--slot-row-start': String(slot.rowStart),
    '--connector-span': String(slot.connectorSpan),
  }
}
</script>

<template>
  <div :class="$style.viewport">
    <div :class="$style.columns">
      <section
        v-for="track in mainTracks"
        :key="track.stage"
        :class="$style.roundColumn"
        :data-round-column="track.stage"
      >
        <header :class="$style.roundHeader">{{ track.label }}</header>

        <div :class="$style.roundTrack" :data-stage-track="track.stage">
          <div
            v-for="slot in track.slots"
            :key="slot.roundMatch.id"
            :class="[
              $style.slotShell,
              slot.hasIncomingConnector ? $style.slotIncoming : null,
              slot.hasOutgoingConnector ? $style.slotOutgoing : null,
            ]"
            :data-match-id="slot.roundMatch.id"
            :data-row-start="slot.rowStart"
            :style="slotStyle(slot)"
          >
            <span v-if="slot.hasIncomingConnector" :class="$style.connectorStem"></span>
            <BracketNode :round-match="slot.roundMatch" :now="props.now" />
          </div>
        </div>
      </section>

      <section :class="[$style.roundColumn, $style.terminalColumn]" data-round-column="terminal">
        <div v-for="track in terminalTracks" :key="track.stage" :class="$style.terminalStage">
          <header :class="$style.roundHeader">{{ track.label }}</header>

          <div :class="$style.roundTrack" :data-stage-track="track.stage">
            <div
              v-for="slot in track.slots"
              :key="slot.roundMatch.id"
              :class="[
                $style.slotShell,
                slot.hasIncomingConnector ? $style.slotIncoming : null,
                slot.hasOutgoingConnector ? $style.slotOutgoing : null,
                track.stage === BRACKET_ROUND_STAGE.THIRD_PLACE ? $style.slotSupplementary : null,
              ]"
              :data-match-id="slot.roundMatch.id"
              :data-row-start="slot.rowStart"
              :style="slotStyle(slot)"
            >
              <span v-if="slot.hasIncomingConnector" :class="$style.connectorStem"></span>
              <BracketNode :round-match="slot.roundMatch" :now="props.now" />
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style module>
.viewport {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  padding-bottom: 8px;
}

.columns {
  --column-gap: 26px;
  --slot-size: 84px;
  --connector-size: calc(var(--column-gap) / 2 + 2px);
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr)) minmax(220px, 1.02fr);
  gap: var(--column-gap);
  align-items: start;
  min-width: max-content;
}

.roundColumn {
  display: grid;
  gap: 12px;
}

.terminalColumn {
  gap: 20px;
}

.terminalStage {
  display: grid;
  gap: 12px;
}

.roundHeader {
  padding: 0 2px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.roundTrack {
  position: relative;
  display: grid;
  grid-template-rows: repeat(32, var(--slot-size));
}

.slotShell {
  position: relative;
  grid-row: var(--slot-row-start);
  display: flex;
  align-items: center;
  min-width: 0;
}

.slotShell :global(article) {
  width: 100%;
}

.slotIncoming::before,
.slotOutgoing::after {
  content: '';
  position: absolute;
  top: 50%;
  border-top: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  transform: translateY(-50%);
}

.slotIncoming::before {
  left: calc(var(--connector-size) * -1);
  width: var(--connector-size);
}

.slotOutgoing::after {
  right: calc(var(--connector-size) * -1);
  width: var(--connector-size);
}

.connectorStem {
  position: absolute;
  left: calc(var(--connector-size) * -1);
  top: calc(50% - (var(--connector-span) * var(--slot-size) / 2));
  height: calc(var(--connector-span) * var(--slot-size));
  border-left: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
}

.slotSupplementary::before,
.slotSupplementary .connectorStem {
  left: calc(var(--connector-size) * -0.72);
}

@media (min-width: 1400px) {
  .columns {
    grid-template-columns: repeat(4, minmax(236px, 1fr)) minmax(232px, 1.04fr);
  }
}

@media (max-width: 960px) {
  .columns {
    --column-gap: 18px;
    --slot-size: 78px;
  }

  .roundHeader {
    font-size: 13px;
  }
}

@media print {
  .viewport {
    overflow: visible;
    padding-bottom: 0;
  }

  .columns {
    --column-gap: 6px;
    --slot-size: 34px;
    grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, 1fr);
    min-width: 0;
  }

  .roundColumn,
  .terminalColumn,
  .terminalStage {
    gap: 4px;
  }

  .roundHeader {
    padding: 0;
    font-size: 8px;
    line-height: 1.1;
  }
}
</style>
