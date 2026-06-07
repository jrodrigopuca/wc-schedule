<script setup lang="ts">
// DaySelector — horizontal scrollable chip strip listing the 39
// tournament days. Each chip shows the day number (or "Hoy" if it's
// the host's today) plus the formatted local date. Days with zero
// matches are visible but muted; the active chip (the one whose YMD
// matches `selectedYMD`, falling back to today when `selectedYMD ===
// null`) is emphasized.
//
// The component is pure presentation — it does NOT read the URL hash
// or call `selectDay()`. The parent owns the navigation; the chip
// emits `select` with the day's YMD on click.
//
// SSR-safety: the auto-scroll lives in `onMounted`, so the
// `scrollIntoView` call only fires in the browser. The render itself
// does not touch DOM globals.
import { computed, onMounted, ref } from 'vue'
import type { Match } from '@/matches/domain/match'
import { dayMatchCount } from '@/matches/domain/day-matches'
import { enumerateTournamentDays, ymdForNow } from '@/matches/domain/tournament-day'
import { useI18n } from '@/shared/i18n/useI18n'
import { formatDate } from '@/shared/time/format'

const props = defineProps<{
  matches: readonly Match[]
  selectedYMD: string | null
  now: number
}>()

const emit = defineEmits<{
  (e: 'select', dayYMD: string): void
}>()

const { t, current: locale } = useI18n()

interface ChipModel {
  readonly number: number
  readonly dateYMD: string
  readonly isToday: boolean
  readonly isActive: boolean
  readonly isEmpty: boolean
  readonly topLabel: string
  readonly bottomLabel: string
  readonly ariaLabel: string
}

const todayYMD = computed(() => ymdForNow(props.now))

const activeYMD = computed(() => props.selectedYMD ?? todayYMD.value)

const chips = computed<readonly ChipModel[]>(() => {
  const days = enumerateTournamentDays(props.now)
  const localeMap = locale.value === 'es' ? 'es-AR' : 'en-US'
  return days.map((day) => {
    const isToday = day.dateYMD === todayYMD.value
    const isActive = day.dateYMD === activeYMD.value
    const isEmpty = dayMatchCount(props.matches, day.dateYMD, props.now) === 0
    const utcStartIso = new Date(day.utcStartMs).toISOString()
    const dateLabel = formatDate(utcStartIso, localeMap)
    const topLabel = isToday ? t('day.today') : t('day.label', { n: day.number })
    return {
      number: day.number,
      dateYMD: day.dateYMD,
      isToday,
      isActive,
      isEmpty,
      topLabel,
      bottomLabel: dateLabel,
      ariaLabel: `${topLabel} · ${dateLabel}`,
    }
  })
})

const stripEl = ref<HTMLElement | null>(null)

onMounted(() => {
  if (typeof window === 'undefined') return
  const strip = stripEl.value
  if (strip === null) return
  const active = strip.querySelector<HTMLElement>('[data-chip-active="true"]')
  if (active === null) return
  // `behavior: 'instant'` keeps the mount-time scroll silent; the
  // browser also accepts `'auto'` as a synonym. Wrapped in try/catch
  // because older WebKit builds throw on the options-object form.
  try {
    active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' })
  } catch {
    active.scrollIntoView()
  }
})

function onChipClick(dayYMD: string): void {
  emit('select', dayYMD)
}
</script>

<template>
  <nav :class="$style.selector" :aria-label="t('day.selector.aria')">
    <ul ref="stripEl" :class="$style.strip">
      <li v-for="chip in chips" :key="chip.dateYMD" :class="$style.item">
        <button
          type="button"
          :class="[
            $style.chip,
            chip.isActive && $style.chipActive,
            chip.isEmpty && $style.chipEmpty,
            chip.isToday && $style.chipToday,
          ]"
          :data-chip-active="chip.isActive ? 'true' : 'false'"
          :data-empty="chip.isEmpty ? 'true' : 'false'"
          :aria-pressed="chip.isActive"
          :aria-current="chip.isToday ? 'date' : undefined"
          :aria-label="chip.ariaLabel"
          @click="onChipClick(chip.dateYMD)"
        >
          <span :class="$style.chipTop">{{ chip.topLabel }}</span>
          <span :class="$style.chipBottom">{{ chip.bottomLabel }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style module>
.selector {
  width: 100%;
  /* Bleed past the parent's horizontal padding (22px in App.vue) so the
     strip can scroll edge-to-edge while the rest of the content stays
     centered. */
  margin: 0 -22px;
  padding: 0 22px;
}

.strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 4px 0 8px;
  margin: 0;
  list-style: none;
}

.strip::-webkit-scrollbar {
  display: none;
}

.item {
  list-style: none;
  scroll-snap-align: center;
  flex: 0 0 auto;
}

.chip {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-base);
  cursor: pointer;
  font-family: inherit;
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease,
    transform 120ms ease;
}

.chip:hover,
.chip:focus-visible {
  background: var(--bg-pill);
  color: var(--text-strong);
}

.chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chipTop {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}

.chipBottom {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.01em;
  margin-top: 2px;
  text-transform: capitalize;
}

.chipActive {
  background: var(--bg-pill);
  border-color: var(--accent);
}

.chipActive .chipTop {
  color: var(--text-strong);
}

.chipEmpty {
  opacity: 0.55;
}

.chipEmpty .chipTop,
.chipEmpty .chipBottom {
  color: var(--text-muted);
}

.chipToday {
  border-color: var(--accent);
}

.chipToday .chipTop {
  color: var(--accent-strong);
}
</style>
