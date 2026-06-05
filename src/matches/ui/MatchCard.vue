<script setup lang="ts">
import { computed } from 'vue'
import type { Match, Stage } from '@/matches/domain/match'
import { resolveState } from '@/matches/domain/resolve-state'
import { resolveFlag } from '@/shared/flags/resolve'
import { resolveGlow } from '@/shared/flags/team-colors'
import type { MessageKey } from '@/shared/i18n/types'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatTime } from '@/shared/time/format'

type HaloStyle = { [K in `--${string}`]: string }

const props = defineProps<{ match: Match; now: number }>()

const { t, country } = useI18n()

// Stage → message key. Mirrors FeaturedCard; lift to a shared helper if a
// third caller appears.
const STAGE_KEYS: Record<Stage, MessageKey> = {
  group: 'stage.group',
  'round-of-32': 'stage.roundOf32',
  'round-of-16': 'stage.roundOf16',
  'quarter-final': 'stage.quarterFinal',
  'semi-final': 'stage.semiFinal',
  'third-place': 'stage.thirdPlace',
  final: 'stage.final',
}

const resolvedStatus = computed(() => resolveState(props.match, props.now))
const stageLabel = computed(() => t(STAGE_KEYS[props.match.stage]))
const kickoffLocal = computed(() => formatTime(props.match.utcKickoff))

const flagA = computed(() => resolveFlag(props.match.teamA.iso))
const flagB = computed(() => resolveFlag(props.match.teamB.iso))

const teamAName = computed(() => country(props.match.teamA.iso) ?? props.match.teamA.name)
const teamBName = computed(() => country(props.match.teamB.iso) ?? props.match.teamB.name)

// Score is rendered ONLY for finished matches. Live scores would require
// short-interval polling we don't have (daily-refresh architecture).
const showScore = computed(
  () => resolvedStatus.value === 'finished' && props.match.score !== undefined,
)

interface BadgeDescriptor {
  readonly text: string
  readonly variant: 'scheduled' | 'live' | 'finished' | 'postponed'
}

const badge = computed<BadgeDescriptor | null>(() => {
  const status = resolvedStatus.value
  if (status === 'scheduled') return { text: t('match.badge.scheduled'), variant: 'scheduled' }
  if (status === 'live') return { text: t('match.badge.live'), variant: 'live' }
  if (status === 'finished') return { text: t('match.badge.finished'), variant: 'finished' }
  if (status === 'postponed') return { text: t('match.badge.postponed'), variant: 'postponed' }
  return null
})

const ariaLabel = computed(
  () => `${teamAName.value} vs ${teamBName.value}, ${kickoffLocal.value}, ${stageLabel.value}`,
)

const haloStyle = computed<HaloStyle>(() => ({
  '--team-a-glow': resolveGlow(props.match.teamA.iso),
  '--team-b-glow': resolveGlow(props.match.teamB.iso),
}))
</script>

<template>
  <li
    v-if="match.status !== 'cancelled' && badge !== null"
    :class="$style.match"
    :style="haloStyle"
    :aria-label="ariaLabel"
  >
    <div :class="$style.time">
      <strong>{{ kickoffLocal }}</strong>
      <span>{{ stageLabel }}</span>
    </div>
    <div :class="$style.teams">
      <div :class="$style.row">
        <div :class="$style.miniFlag">
          <img v-if="flagA !== null" :src="flagA" :alt="teamAName" />
        </div>
        <span :class="$style.teamName">{{ teamAName }}</span>
        <span v-if="showScore && match.score" :class="$style.score">{{ match.score.home }}</span>
      </div>
      <div :class="$style.row">
        <div :class="$style.miniFlag">
          <img v-if="flagB !== null" :src="flagB" :alt="teamBName" />
        </div>
        <span :class="$style.teamName">{{ teamBName }}</span>
        <span v-if="showScore && match.score" :class="$style.score">{{ match.score.away }}</span>
      </div>
    </div>
    <span :class="[$style.badge, $style[`badge_${badge.variant}`]]">
      {{ badge.text }}
    </span>
  </li>
</template>

<style module>
.match {
  background:
    radial-gradient(
      circle at 0% 50%,
      color-mix(
          in srgb,
          var(--team-a-glow, transparent) calc(var(--matchcard-halo-opacity) * 100%),
          transparent
        )
        0%,
      transparent 45%
    ),
    radial-gradient(
      circle at 100% 50%,
      color-mix(
          in srgb,
          var(--team-b-glow, transparent) calc(var(--matchcard-halo-opacity) * 100%),
          transparent
        )
        0%,
      transparent 45%
    ),
    var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  display: grid;
  grid-template-columns: 56px 1fr auto;
  align-items: center;
  gap: 14px;
  box-shadow: var(--shadow-sm);
  list-style: none;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background 200ms ease,
    border-color 200ms ease;
}

.match:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.time {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.time strong {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.time span {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.teams {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-base);
}

.miniFlag {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: var(--bg-pill);
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--border);
}

.miniFlag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.teamName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  margin-left: auto;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.badge_scheduled {
  background: var(--bg-pill);
  color: var(--text-muted);
}

.badge_finished {
  background: var(--bg-pill);
  color: var(--text-muted);
}

.badge_postponed {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.badge_live {
  background: var(--live-soft);
  color: var(--live-strong);
  position: relative;
}

.badge_live::before {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--live);
  border-radius: var(--radius-pill);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.85);
  }
}
</style>
