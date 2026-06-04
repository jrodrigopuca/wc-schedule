<script setup lang="ts">
import { computed } from 'vue'
import { useCountdown } from '@/featured/composables/useCountdown'
import { useI18n } from '@/shared/i18n/useI18n'

const props = defineProps<{ targetMs: number }>()

const { remaining } = useCountdown(() => props.targetMs)
const { t } = useI18n()

const DAY_MS = 86_400_000

interface CountdownParts {
  readonly days: number | null
  readonly daysDisplay: string | null
  readonly hours: string
  readonly minutes: string
  readonly seconds: string
}

const parts = computed<CountdownParts>(() => {
  const ms = remaining.value
  const dayCount = ms >= DAY_MS ? Math.floor(ms / DAY_MS) : null
  const rest = dayCount !== null ? ms - dayCount * DAY_MS : ms
  const totalSeconds = Math.floor(rest / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return {
    days: dayCount,
    daysDisplay: dayCount !== null ? pad(dayCount) : null,
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
  }
})

const ariaText = computed(() => {
  const { days, hours, minutes, seconds } = parts.value
  return days !== null
    ? `${t('time.daysCount', { n: days })}, ${hours}:${minutes}:${seconds}`
    : `${hours}:${minutes}:${seconds}`
})

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
</script>

<template>
  <output :class="$style.countdown" aria-live="polite" :aria-label="ariaText">
    <template v-if="parts.daysDisplay !== null">
      <span :class="$style.value">{{ parts.daysDisplay }}</span>
      <span :class="$style.sep"> · </span>
    </template>
    <span :class="$style.value">{{ parts.hours }}</span>
    <span :class="$style.sep">:</span>
    <span :class="$style.value">{{ parts.minutes }}</span>
    <span :class="$style.sep">:</span>
    <span :class="$style.value">{{ parts.seconds }}</span>
  </output>
</template>

<style module>
.countdown {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: 54px;
  font-weight: 800;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--text-inverse);
}

.value {
  color: var(--text-inverse);
}

.sep {
  color: var(--text-inverse-muted);
  font-weight: 500;
  padding: 0 2px;
}
</style>
