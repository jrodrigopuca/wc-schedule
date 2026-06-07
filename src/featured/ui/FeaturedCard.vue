<script setup lang="ts">
import { computed } from 'vue'
import { assertNever, type FeaturedState } from '@/featured/domain/featured-state'
import type { Match } from '@/matches/domain/match'
import { STAGE_KEYS } from '@/matches/i18n/stage-labels'
import { useI18n } from '@/shared/i18n/useI18n'
import { resolveFlag } from '@/shared/flags/resolve'
import { resolveGlow } from '@/shared/flags/team-colors'
import { formatRelativeDay, formatTime } from '@/shared/time/format'
import Countdown from '@/featured/ui/Countdown.vue'

const props = defineProps<{ state: FeaturedState; now: number }>()

const { t, country } = useI18n()

type HaloStyle = { [K in `--${string}`]: string }

function haloFor(match: Match): HaloStyle {
  return {
    '--team-a-glow': resolveGlow(match.teamA.iso),
    '--team-b-glow': resolveGlow(match.teamB.iso),
  }
}

function neutralHalo(color: string): HaloStyle {
  return { '--team-a-glow': color, '--team-b-glow': color }
}

const rootStyle = computed<HaloStyle>(() => {
  switch (props.state.kind) {
    case 'live-single':
    case 'upcoming-today':
    case 'upcoming-future':
      return haloFor(props.state.match)
    case 'live-multiple':
      return neutralHalo('var(--live-soft)')
    case 'tournament-over':
      return neutralHalo('var(--text-muted)')
    default:
      return assertNever(props.state)
  }
})

const isLiveVariant = computed(
  () => props.state.kind === 'live-single' || props.state.kind === 'live-multiple',
)

const eyebrow = computed(() => {
  switch (props.state.kind) {
    case 'live-single':
    case 'live-multiple':
      return t('featured.eyebrow.live')
    case 'upcoming-today':
      return t('featured.eyebrow.upcomingToday')
    case 'upcoming-future':
      return t('featured.eyebrow.upcomingFuture')
    case 'tournament-over':
      return t('header.subtitle')
    default:
      return assertNever(props.state)
  }
})

function teamLabel(iso: string, fallback: string): string {
  return country(iso) ?? fallback
}

function stageLabelFor(match: Match): string {
  return t(STAGE_KEYS[match.stage])
}

defineSlots<{
  'notify-cta'(): unknown
}>()

function metaParts(match: Match, withDate: boolean): readonly string[] {
  const parts: string[] = []
  const localTime = formatTime(match.utcKickoff)
  const localTimeLabel = t('featured.meta.localTime')
  if (withDate) {
    parts.push(`${formatRelativeDay(match.utcKickoff, props.now)} · ${localTime} ${localTimeLabel}`)
  } else {
    parts.push(`${localTime} ${localTimeLabel}`)
  }
  if (match.group !== undefined) {
    parts.push(t('match.group', { letter: match.group }))
  } else {
    parts.push(stageLabelFor(match))
  }
  if (match.venue !== undefined) parts.push(match.venue.city)
  return parts
}
</script>

<template>
  <section
    :class="[$style.featured, isLiveVariant ? $style.featuredLive : null]"
    :style="rootStyle"
    :data-variant="state.kind"
  >
    <div :class="$style.eyebrow">{{ eyebrow }}</div>

    <template v-if="state.kind === 'live-single'">
      <div :class="$style.derby">
        <div :class="$style.team">
          <div :class="$style.flag">
            <img
              v-if="resolveFlag(state.match.teamA.iso) !== null"
              :src="resolveFlag(state.match.teamA.iso) ?? ''"
              :alt="`${teamLabel(state.match.teamA.iso, state.match.teamA.name)}`"
            />
          </div>
          <div :class="$style.teamName">
            {{ teamLabel(state.match.teamA.iso, state.match.teamA.name) }}
          </div>
        </div>
        <div :class="$style.vs">VS</div>
        <div :class="$style.team">
          <div :class="$style.flag">
            <img
              v-if="resolveFlag(state.match.teamB.iso) !== null"
              :src="resolveFlag(state.match.teamB.iso) ?? ''"
              :alt="`${teamLabel(state.match.teamB.iso, state.match.teamB.name)}`"
            />
          </div>
          <div :class="$style.teamName">
            {{ teamLabel(state.match.teamB.iso, state.match.teamB.name) }}
          </div>
        </div>
      </div>

      <p :class="$style.liveText">{{ t('featured.live.text') }}</p>

      <div :class="$style.meta">
        <span>{{ stageLabelFor(state.match) }}</span>
        <template v-if="state.match.group !== undefined">
          <span :class="$style.dot" />
          <span>{{ t('match.group', { letter: state.match.group }) }}</span>
        </template>
        <template v-if="state.match.venue !== undefined">
          <span :class="$style.dot" />
          <span>{{ state.match.venue.city }}</span>
        </template>
      </div>

      <div :class="$style.ctaSlot">
        <slot name="notify-cta" />
      </div>
    </template>

    <template v-else-if="state.kind === 'live-multiple'">
      <div :class="$style.multi">
        <p :class="$style.multiHeadline">
          {{ t('featured.multiLive.title', { n: state.count }) }}
        </p>
        <p :class="$style.multiSub">{{ t('featured.multiLive.hint') }}</p>
      </div>
    </template>

    <template v-else-if="state.kind === 'upcoming-today' || state.kind === 'upcoming-future'">
      <div :class="$style.derby">
        <div :class="$style.team">
          <div :class="$style.flag">
            <img
              v-if="resolveFlag(state.match.teamA.iso) !== null"
              :src="resolveFlag(state.match.teamA.iso) ?? ''"
              :alt="`${teamLabel(state.match.teamA.iso, state.match.teamA.name)}`"
            />
          </div>
          <div :class="$style.teamName">
            {{ teamLabel(state.match.teamA.iso, state.match.teamA.name) }}
          </div>
        </div>
        <div :class="$style.vs">VS</div>
        <div :class="$style.team">
          <div :class="$style.flag">
            <img
              v-if="resolveFlag(state.match.teamB.iso) !== null"
              :src="resolveFlag(state.match.teamB.iso) ?? ''"
              :alt="`${teamLabel(state.match.teamB.iso, state.match.teamB.name)}`"
            />
          </div>
          <div :class="$style.teamName">
            {{ teamLabel(state.match.teamB.iso, state.match.teamB.name) }}
          </div>
        </div>
      </div>

      <div :class="$style.countdownBlock">
        <Countdown :target-ms="Date.parse(state.match.utcKickoff)" />
      </div>

      <div :class="$style.meta">
        <template
          v-for="(part, idx) in metaParts(state.match, state.kind === 'upcoming-future')"
          :key="part"
        >
          <span v-if="idx > 0" :class="$style.dot" />
          <span>{{ part }}</span>
        </template>
      </div>

      <div :class="$style.ctaSlot">
        <slot name="notify-cta" />
      </div>
    </template>

    <template v-else-if="state.kind === 'tournament-over'">
      <div :class="$style.terminal">
        <p :class="$style.terminalHeadline">{{ t('featured.tournamentOver.title') }}</p>
        <p :class="$style.terminalSub">{{ t('featured.tournamentOver.subtitle') }}</p>
      </div>
    </template>
  </section>
</template>

<style module>
.featured {
  background:
    radial-gradient(
      circle at 18% 50%,
      color-mix(
          in srgb,
          var(--team-a-glow, transparent) calc(var(--halo-opacity) * 100%),
          transparent
        )
        0%,
      transparent 45%
    ),
    radial-gradient(
      circle at 82% 50%,
      color-mix(
          in srgb,
          var(--team-b-glow, transparent) calc(var(--halo-opacity) * 100%),
          transparent
        )
        0%,
      transparent 45%
    ),
    var(--bg-featured);
  color: var(--text-on-featured);
  border-radius: var(--radius-lg);
  padding: 28px 22px 22px;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-md);
  border: 1px solid color-mix(in srgb, var(--text-on-featured) 6%, transparent);
}

.featuredLive {
  background:
    radial-gradient(
      circle at 18% 50%,
      color-mix(
          in srgb,
          var(--team-a-glow, transparent) calc(var(--halo-opacity) * 100%),
          transparent
        )
        0%,
      transparent 45%
    ),
    radial-gradient(
      circle at 82% 50%,
      color-mix(
          in srgb,
          var(--team-b-glow, transparent) calc(var(--halo-opacity) * 100%),
          transparent
        )
        0%,
      transparent 45%
    ),
    radial-gradient(
      circle at 50% -10%,
      color-mix(in srgb, var(--live) 30%, transparent) 0%,
      transparent 55%
    ),
    var(--bg-featured);
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-strong);
  margin-bottom: 22px;
  position: relative;
}

.eyebrow::before {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: var(--radius-pill);
}

.featuredLive .eyebrow {
  color: var(--live-strong);
}

.featuredLive .eyebrow::before {
  background: var(--live);
  animation: featuredPulse 1.4s ease-in-out infinite;
}

.derby {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
  position: relative;
}

.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.flag {
  width: 88px;
  height: 88px;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: color-mix(in srgb, var(--text-on-featured) 4%, transparent);
  display: grid;
  place-items: center;
  box-shadow:
    inset 0 0 0 2px var(--ring-flag),
    var(--ring-flag-shadow);
  position: relative;
}

.flag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.flag::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  pointer-events: none;
}

.teamName {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: center;
  color: var(--text-on-featured);
}

.vs {
  display: grid;
  place-items: center;
  align-self: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-pill);
  border: 1.5px solid color-mix(in srgb, var(--text-on-featured) 20%, transparent);
  background: color-mix(in srgb, var(--text-on-featured) 4%, transparent);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: var(--text-on-featured);
  font-style: italic;
  margin-top: -22px;
}

.countdownBlock {
  text-align: center;
  margin-bottom: 16px;
  position: relative;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  font-size: 12px;
  color: var(--text-on-featured-muted);
  font-weight: 500;
  position: relative;
  flex-wrap: wrap;
}

.meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 3px;
  height: 3px;
  background: var(--text-on-featured-muted);
  border-radius: var(--radius-pill);
}

.ctaSlot {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.liveText {
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-on-featured);
  margin: 12px 0 22px;
  line-height: 1.2;
}

.multi {
  text-align: center;
  padding: 18px 0 6px;
}

.multiHeadline {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-on-featured);
  margin-bottom: 6px;
}

.multiSub {
  font-size: 13px;
  color: var(--text-on-featured-muted);
  font-weight: 500;
}

.terminal {
  text-align: center;
  padding: 24px 0 16px;
}

.terminalHeadline {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text-on-featured);
  margin-bottom: 6px;
}

.terminalSub {
  font-size: 13px;
  color: var(--text-on-featured-muted);
  font-weight: 500;
}

@keyframes featuredPulse {
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
