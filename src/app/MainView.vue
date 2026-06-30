<script setup lang="ts">
// MainView. Renders the featured card + today's matches list driven by the
// singleton data layer (`useMatches`) and tick (`useNow`). The notify CTA is
// injected into FeaturedCard via the `notify-cta` slot so the featured-domain
// component stays decoupled from notifications-domain code.
//
// Day-navigation surface: a `DaySelector` chip strip sits at the very top
// of the view. When the URL hash is `#/day/YYYY-MM-DD` (and the chosen
// day is NOT today), the view collapses to a single section — just the
// MatchesList for that day, no FeaturedCard. Today + empty hash is the
// canonical "main mode": FeaturedCard + MatchesList for today.
import { computed, watch } from 'vue'
import { useFeatured } from '@/featured/composables/useFeatured'
import FeaturedCard from '@/featured/ui/FeaturedCard.vue'
import { useMatches } from '@/matches/composables/useMatches'
import { useSelectedDay } from '@/matches/composables/useSelectedDay'
import { useNotifications } from '@/notifications/composables/useNotifications'
import { planSchedule } from '@/notifications/domain/schedule'
import { useI18n } from '@/shared/i18n/useI18n'
import { useNow } from '@/shared/time/useNow'
import { useRoute } from '@/app/router'
import { ymdForNow } from '@/matches/domain/tournament-day'
import DaySelector from '@/matches/ui/DaySelector.vue'
import MatchesList from '@/matches/ui/MatchesList.vue'
import EnableNotificationsButton from '@/notifications/ui/EnableNotificationsButton.vue'
import { formatDate } from '@/shared/time/format'
import { getNow } from '@/shared/time/now'
import { dayBoundsForYMD } from '@/matches/domain/tournament-day'

const { t, current: locale } = useI18n()
const { matches, status, sourceName } = useMatches()
const { featured } = useFeatured(matches)
const { now } = useNow()
const { navigate } = useRoute()
const { selectedYMD, selectDay } = useSelectedDay()
const { permission, schedule: scheduleNotifications } = useNotifications()

// All-or-nothing scheduling: granting permission arms a `setTimeout` for
// EVERY future match in `matches` (up to ~104 over the tournament). The
// browser's quota is high enough that this isn't a memory concern, and
// the model lets users grant once and forget. Revoking via browser
// settings cancels at the OS level — we re-check `permission` on
// visibility-regain (handled by `useMatches`' refresh path, which
// updates `matches` → re-fires this watcher).
//
// This watcher fires on:
//   - initial mount (immediate: true) — picks up matches loaded at boot
//   - permission flipping from idle → granted (post user-gesture grant)
//   - matches replaced by `useMatches.refresh()` (visibility regain or
//     `refresh()` call after a successful new walk)
//
// `planSchedule` is pure + atomic-replace: the notifier cancels prior
// timers before arming, so re-firing is safe and dedupe-by-tag at the
// OS level handles any in-flight race.
watch(
  [matches, permission],
  ([currentMatches, currentPermission]) => {
    if (currentPermission !== 'granted') return
    scheduleNotifications(planSchedule(currentMatches, getNow()))
  },
  { immediate: true },
)

const hasData = computed(() => status.value === 'ready' || status.value === 'degraded')

// Data freshness indicator. Two states:
//   - 'fresh' (green dot): live remote fetch succeeded
//   - 'stale' (amber dot): fell back to cached snapshot or bundled fixture
// The label lives in the `title`/`aria-label` of the dot — no visible text
// so the footer stays minimal and the casual viewer isn't startled.
const dataIndicator = computed<{ kind: 'fresh' | 'stale'; label: string } | null>(() => {
  if (!hasData.value) return null
  if (status.value === 'degraded') {
    if (sourceName.value === 'history') return { kind: 'stale', label: t('data.stale.history') }
    if (sourceName.value === 'manual') return { kind: 'stale', label: t('data.stale.fixture') }
    return { kind: 'stale', label: t('data.stale.fixture') }
  }
  return { kind: 'fresh', label: t('data.fresh') }
})

const todayYMD = computed(() => ymdForNow(now.value))

// Day mode: a non-today YMD is selected. Drives layout branching.
const isDayMode = computed(() => selectedYMD.value !== null && selectedYMD.value !== todayYMD.value)

// Resolves the tournament-day number for the selected day's label.
// 2026-06-11 = day 1; later days follow. We compute from the local-day
// bounds so the offset is consistent across DST quirks.
const TOURNAMENT_START_MS = dayBoundsForYMD('2026-06-11').utcStartMs
const DAY_MS = 86_400_000

const selectedDayNumber = computed(() => {
  if (selectedYMD.value === null) return null
  const { utcStartMs } = dayBoundsForYMD(selectedYMD.value)
  const n = Math.round((utcStartMs - TOURNAMENT_START_MS) / DAY_MS) + 1
  return n
})

const selectedDayTitle = computed(() => {
  if (selectedYMD.value === null) return ''
  const localeMap = locale.value === 'es' ? 'es-AR' : 'en-US'
  const isoStart = new Date(dayBoundsForYMD(selectedYMD.value).utcStartMs).toISOString()
  const dateLabel = formatDate(isoStart, localeMap)
  const n = selectedDayNumber.value
  // Within-tournament: show "Día N · <date>". Out-of-window: fall back
  // to the date alone so the heading still makes sense.
  if (n !== null && n >= 1 && n <= 39) {
    return `${t('day.label', { n })} · ${dateLabel}`
  }
  return dateLabel
})

function openGallery(event: Event): void {
  event.preventDefault()
  navigate('preview')
}

function openBracket(event: Event): void {
  event.preventDefault()
  navigate('bracket')
}

function onSelectDay(dayYMD: string): void {
  // Clicking today's chip resets to the canonical main route (empty hash).
  if (dayYMD === todayYMD.value) {
    selectDay(null)
    return
  }
  selectDay(dayYMD)
}
</script>

<template>
  <div :class="$style.view">
    <DaySelector
      :matches="matches"
      :selected-y-m-d="selectedYMD"
      :now="now"
      @select="onSelectDay"
    />

    <section v-if="status === 'idle' || status === 'loading'" :class="$style.message">
      <h1 :class="$style.title">{{ t('main.loading.title') }}</h1>
      <p :class="$style.body">{{ t('main.loading.body') }}</p>
    </section>

    <template v-else-if="hasData">
      <template v-if="isDayMode && selectedYMD !== null">
        <header :class="$style.dayHeader">
          <h1 :class="$style.dayTitle">{{ selectedDayTitle }}</h1>
        </header>
        <MatchesList :matches="matches" :now="now" :day-y-m-d="selectedYMD" />
      </template>

      <template v-else>
        <FeaturedCard :state="featured" :now="now">
          <template #notify-cta>
            <EnableNotificationsButton />
          </template>
        </FeaturedCard>

        <MatchesList :matches="matches" :now="now" />
      </template>
    </template>

    <section v-else :class="$style.message">
      <h1 :class="$style.title">{{ t('main.error.title') }}</h1>
      <p :class="$style.body">{{ t('main.error.body') }}</p>
    </section>

    <footer :class="$style.footer">
      <span
        v-if="dataIndicator !== null"
        :class="[
          $style.statusDot,
          dataIndicator.kind === 'fresh' ? $style.statusDotFresh : $style.statusDotStale,
        ]"
        role="img"
        :aria-label="dataIndicator.label"
        :title="dataIndicator.label"
      />
      <div :class="$style.quickLinks">
        <a :class="$style.quickLink" href="#/bracket" @click="openBracket">
          &rarr; {{ t('nav.openBracket') }}
        </a>
        <a :class="$style.quickLink" href="#/preview" @click="openGallery">
          &rarr; {{ t('nav.openGallery') }}
        </a>
      </div>
    </footer>
  </div>
</template>

<style module>
.view {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 48px 16px 24px;
  text-align: center;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.body {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
}

.dayHeader {
  padding: 0 4px;
}

.dayTitle {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
  text-transform: capitalize;
}

.footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 4px 0 24px;
}

.quickLinks {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.statusDot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
  cursor: help;
  transition: background-color 200ms ease;
}

.statusDotFresh {
  background-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.statusDotStale {
  background-color: #f59e0b;
  box-shadow: 0 0 0 3px color-mix(in srgb, #f59e0b 18%, transparent);
}

.quickLink {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  transition:
    color 160ms ease,
    background 160ms ease;
}

.quickLink:hover,
.quickLink:focus-visible {
  color: var(--text-strong);
  background: var(--bg-pill);
}

.quickLink:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
