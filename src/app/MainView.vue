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
import { computed } from 'vue'
import { useFeatured } from '@/featured/composables/useFeatured'
import FeaturedCard from '@/featured/ui/FeaturedCard.vue'
import { useMatches } from '@/matches/composables/useMatches'
import { useSelectedDay } from '@/matches/composables/useSelectedDay'
import { useI18n } from '@/shared/i18n/useI18n'
import { useNow } from '@/shared/time/useNow'
import { useRoute } from '@/app/router'
import { ymdForNow } from '@/matches/domain/tournament-day'
import DaySelector from '@/matches/ui/DaySelector.vue'
import MatchesList from '@/matches/ui/MatchesList.vue'
import EnableNotificationsButton from '@/notifications/ui/EnableNotificationsButton.vue'
import { formatDate } from '@/shared/time/format'
import { dayBoundsForYMD } from '@/matches/domain/tournament-day'

const { t, current: locale } = useI18n()
const { matches, status, sourceName } = useMatches()
const { featured } = useFeatured(matches)
const { now } = useNow()
const { navigate } = useRoute()
const { selectedYMD, selectDay } = useSelectedDay()

const hasData = computed(() => status.value === 'ready' || status.value === 'degraded')

const staleMessage = computed(() => {
  if (status.value !== 'degraded') return null
  if (sourceName.value === 'history') return t('data.stale.history')
  if (sourceName.value === 'manual') return t('data.stale.fixture')
  return null
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
      <p v-if="staleMessage !== null" :class="$style.stale">{{ staleMessage }}</p>
      <a :class="$style.galleryLink" href="#/preview" @click="openGallery">
        &rarr; {{ t('nav.openGallery') }}
      </a>
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
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 4px 0 24px;
}

.stale {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.galleryLink {
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

.galleryLink:hover,
.galleryLink:focus-visible {
  color: var(--text-strong);
  background: var(--bg-pill);
}

.galleryLink:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
