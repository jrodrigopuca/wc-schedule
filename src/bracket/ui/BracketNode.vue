<script setup lang="ts">
import { computed } from 'vue'
import type { BracketMatchViewModel } from '@/bracket/domain/bracket'
import type { Match } from '@/matches/domain/match'
import { resolveState } from '@/matches/domain/resolve-state'
import { resolveFlag } from '@/shared/flags/resolve'
import { resolveGlow } from '@/shared/flags/team-colors'
import { useI18n } from '@/shared/i18n/useI18n'
import { resolveCode3 } from '@/shared/i18n/country-code3'
import { formatDate, formatTime } from '@/shared/time/format'

type HaloStyle = { [K in `--${string}`]: string }

interface BracketParticipantViewModel {
  readonly label: string
  readonly code: string
  readonly flag: string | null
  readonly glow: string
  readonly isEmpty: boolean
}

interface BadgeDescriptor {
  readonly text: string
  readonly variant: 'scheduled' | 'live' | 'finished' | 'postponed'
}

const props = defineProps<{
  roundMatch: BracketMatchViewModel
  now: number
}>()

const { t, country, current } = useI18n()

const match = computed(() => props.roundMatch.match)
const resolvedStatus = computed(() => {
  const currentMatch = match.value
  if (currentMatch === null) return null
  return resolveState(currentMatch, props.now)
})

const kickoffTime = computed(() => {
  const currentMatch = match.value
  if (currentMatch === null) return null
  return formatTime(currentMatch.utcKickoff, current.value)
})

const kickoffDate = computed(() => {
  const currentMatch = match.value
  if (currentMatch === null) return null
  return formatDate(currentMatch.utcKickoff, current.value)
})

const kickoffLabel = computed(() => {
  if (kickoffDate.value === null || kickoffTime.value === null) return null
  return `${kickoffDate.value} · ${kickoffTime.value}`
})

const badge = computed<BadgeDescriptor | null>(() => {
  const status = resolvedStatus.value
  if (status === 'scheduled') return { text: t('match.badge.scheduled'), variant: 'scheduled' }
  if (status === 'live') return { text: t('match.badge.live'), variant: 'live' }
  if (status === 'finished') return { text: t('match.badge.finished'), variant: 'finished' }
  if (status === 'postponed') return { text: t('match.badge.postponed'), variant: 'postponed' }
  return null
})

const teamA = computed<BracketParticipantViewModel>(() => toParticipant(match.value, 'teamA'))
const teamB = computed<BracketParticipantViewModel>(() => toParticipant(match.value, 'teamB'))
const hasWritablePlaceholder = computed(() => teamA.value.isEmpty || teamB.value.isEmpty)

const showScore = computed(
  () => resolvedStatus.value === 'finished' && match.value?.score !== undefined,
)
const showPenalties = computed(() => showScore.value && match.value?.penalties !== undefined)
const printMeta = computed(() => {
  const currentMatch = match.value
  if (currentMatch === null) return null
  const compactDate = new Intl.DateTimeFormat(current.value, {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(currentMatch.utcKickoff))
  if (kickoffTime.value === null) return compactDate
  if (badge.value?.variant === 'live' || badge.value?.variant === 'postponed') {
    return `${compactDate} ${kickoffTime.value} · ${badge.value.text}`
  }
  return `${compactDate} ${kickoffTime.value}`
})

const haloStyle = computed<HaloStyle>(() => ({
  '--team-a-glow': teamA.value.glow,
  '--team-b-glow': teamB.value.glow,
}))

function toParticipant(
  currentMatch: Match | null,
  side: 'teamA' | 'teamB',
): BracketParticipantViewModel {
  const team = currentMatch?.[side]
  if (team !== undefined) {
    const isEmpty = team.iso === 'xx'
    return {
      label: isEmpty ? '' : (country(team.iso) ?? team.name),
      code: isEmpty ? '' : (resolveCode3(team.iso) ?? team.iso.toUpperCase()),
      flag: isEmpty ? null : resolveFlag(team.iso),
      glow: isEmpty ? 'transparent' : resolveGlow(team.iso),
      isEmpty,
    }
  }

  return {
    label: '',
    code: '',
    flag: null,
    glow: 'transparent',
    isEmpty: true,
  }
}
</script>

<template>
  <article
    :class="[$style.node, hasWritablePlaceholder ? $style.nodeWritable : null]"
    :style="haloStyle"
  >
    <header v-if="kickoffLabel !== null" :class="$style.header">
      <span :class="$style.kickoffDate">{{ kickoffDate }}</span>
      <span :class="$style.kickoffTime">{{ kickoffTime }}</span>
    </header>

    <div :class="$style.teams">
      <div :class="$style.row">
        <div :class="$style.flagWrap">
          <img v-if="teamA.flag !== null" :src="teamA.flag" :alt="teamA.label" />
        </div>
        <span
          :class="[$style.teamName, teamA.isEmpty ? $style.teamNameEmpty : null]"
          :title="teamA.label"
        >
          <span :class="$style.teamCodeText">{{ teamA.code }}</span>
          <span :class="$style.teamFullName">{{ teamA.label }}</span>
        </span>
        <span v-if="showScore && match?.score" :class="$style.scoreWrap">
          <span :class="$style.score">{{ match.score.home }}</span>
          <span v-if="showPenalties && match?.penalties" :class="$style.penalties">
            ({{ match.penalties.home }})
          </span>
        </span>
      </div>

      <div :class="$style.row">
        <div :class="$style.flagWrap">
          <img v-if="teamB.flag !== null" :src="teamB.flag" :alt="teamB.label" />
        </div>
        <span
          :class="[$style.teamName, teamB.isEmpty ? $style.teamNameEmpty : null]"
          :title="teamB.label"
        >
          <span :class="$style.teamCodeText">{{ teamB.code }}</span>
          <span :class="$style.teamFullName">{{ teamB.label }}</span>
        </span>
        <span v-if="showScore && match?.score" :class="$style.scoreWrap">
          <span :class="$style.score">{{ match.score.away }}</span>
          <span v-if="showPenalties && match?.penalties" :class="$style.penalties">
            ({{ match.penalties.away }})
          </span>
        </span>
      </div>
    </div>

    <footer v-if="printMeta !== null" :class="$style.printMeta">{{ printMeta }}</footer>
  </article>
</template>

<style module>
.node {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: 8px 9px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background:
    radial-gradient(
      circle at 0% 50%,
      color-mix(in srgb, var(--team-a-glow, transparent) 20%, transparent) 0%,
      transparent 52%
    ),
    radial-gradient(
      circle at 100% 50%,
      color-mix(in srgb, var(--team-b-glow, transparent) 20%, transparent) 0%,
      transparent 52%
    ),
    var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.nodeWritable {
  border-style: dashed;
}

.header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}

.kickoffDate {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.kickoffTime {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-strong);
}

.teams {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.flagWrap {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: var(--bg-pill);
  box-shadow: inset 0 0 0 1px var(--border);
}

.flagWrap img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.teamName {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--text-base);
}

.teamNameEmpty {
  min-height: 1.2em;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
}

/* On screen the compact 3-letter code is shown; the full name is print-only
   (the PDF has the horizontal room for it and reads better on paper). The
   toggle is pure CSS so there's no print-detection logic in JS. */
.teamFullName {
  display: none;
}

.scoreWrap {
  margin-left: auto;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.score {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-strong);
}

.penalties {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.printMeta {
  display: none;
}

@media print {
  .node {
    gap: 2px;
    padding: 4px 5px;
    border-color: #d0d6dd;
    background: #fff;
    box-shadow: none;
    break-inside: avoid;
  }

  .nodeWritable {
    padding-block: 5px;
  }

  .header {
    display: none;
  }

  .teams {
    gap: 2px;
  }

  .row {
    gap: 3px;
  }

  .flagWrap {
    display: none;
  }

  .teamName {
    font-size: 8.5px;
    line-height: 1.1;
  }

  /* PDF shows the full team name instead of the 3-letter code. At ~8.5px in a
     full-width print column (~180px of text room) the longest WC names still
     fit on one line, so the card height — and the single-page fit — is
     unaffected. */
  .teamCodeText {
    display: none;
  }

  .teamFullName {
    display: inline;
  }

  .teamNameEmpty {
    min-height: 1.45em;
    border-bottom-color: #aeb6c0;
  }

  .scoreWrap {
    gap: 1px;
  }

  .score {
    font-size: 9px;
  }

  .penalties {
    font-size: 7px;
    color: #4b5563;
  }

  .printMeta {
    display: block;
    font-size: 7px;
    line-height: 1.1;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
}
</style>
