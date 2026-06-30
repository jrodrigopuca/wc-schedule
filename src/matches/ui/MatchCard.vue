<script setup lang="ts">
import { computed } from 'vue'
import type { Match } from '@/matches/domain/match'
import { resolveState } from '@/matches/domain/resolve-state'
import { STAGE_KEYS } from '@/matches/i18n/stage-labels'
import AddToCalendarButton from '@/matches/ui/AddToCalendarButton.vue'
import { resolveFlag } from '@/shared/flags/resolve'
import { resolveGlow } from '@/shared/flags/team-colors'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatTime } from '@/shared/time/format'

type HaloStyle = { [K in `--${string}`]: string }

const props = defineProps<{ match: Match; now: number }>()

const { t, country } = useI18n()

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
const showPenalties = computed(() => showScore.value && props.match.penalties !== undefined)

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

// Calendar export is only meaningful for matches the user could still
// attend or anticipate. Skip past events (finished by status OR by clock)
// to avoid encouraging users to add a stale event.
const showCalendarButton = computed(() => {
  if (resolvedStatus.value === 'finished') return false
  const kickoffMs = Date.parse(props.match.utcKickoff)
  if (props.now >= kickoffMs) return false
  return true
})

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
        <span v-if="showScore && match.score" :class="$style.scoreWrap">
          <span :class="$style.score">{{ match.score.home }}</span>
          <span v-if="showPenalties && match.penalties" :class="$style.penalties">
            ({{ match.penalties.home }})
          </span>
        </span>
      </div>
      <div :class="$style.row">
        <div :class="$style.miniFlag">
          <img v-if="flagB !== null" :src="flagB" :alt="teamBName" />
        </div>
        <span :class="$style.teamName">{{ teamBName }}</span>
        <span v-if="showScore && match.score" :class="$style.scoreWrap">
          <span :class="$style.score">{{ match.score.away }}</span>
          <span v-if="showPenalties && match.penalties" :class="$style.penalties">
            ({{ match.penalties.away }})
          </span>
        </span>
      </div>
    </div>
    <div :class="$style.actions">
      <span :class="[$style.badge, $style[`badge_${badge.variant}`]]">
        {{ badge.text }}
      </span>
      <AddToCalendarButton v-if="showCalendarButton" :match="match" />
    </div>
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

.scoreWrap {
  margin-left: auto;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.score {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
}

.penalties {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
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
