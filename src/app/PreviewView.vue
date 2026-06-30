<script setup lang="ts">
// PreviewView: permanent component gallery at #/preview. Documents every
// FeaturedState variant and the MatchCard / Countdown surfaces. The
// `sectionId` labels are LITERAL strings (they document the
// `FeaturedState.kind` enum); the `sectionDescription` paragraph below
// each is localized human copy.
import { computed, ref } from 'vue'
import fixtureData from '@/shared/fixture/matches.fixture.json'
import type { FeaturedState } from '@/featured/domain/featured-state'
import type { Match } from '@/matches/domain/match'
import FeaturedCard from '@/featured/ui/FeaturedCard.vue'
import Countdown from '@/featured/ui/Countdown.vue'
import MatchCard from '@/matches/ui/MatchCard.vue'
import MatchesList from '@/matches/ui/MatchesList.vue'
import DaySelector from '@/matches/ui/DaySelector.vue'
import EnableNotificationsButton from '@/notifications/ui/EnableNotificationsButton.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import { useRoute } from '@/app/router'
import { getNow } from '@/shared/time/now'

const { t } = useI18n()
const { navigate } = useRoute()

const fixtures = fixtureData as readonly Match[]

const now = ref(getNow())

const fixtureById = computed<Record<string, Match>>(() => {
  const map: Record<string, Match> = {}
  for (const m of fixtures) map[m.id] = m
  return map
})

function clone(m: Match): Match {
  return { ...m, teamA: { ...m.teamA }, teamB: { ...m.teamB } }
}

function shift(m: Match, msFromNow: number): Match {
  return { ...clone(m), utcKickoff: new Date(now.value + msFromNow).toISOString() }
}

// Pick a representative scheduled match from the fixture as the visual base.
const baseMatch = computed<Match>(
  () => fixtureById.value['wc2026-g-c-01'] ?? (fixtures[0] as Match),
)

// upcoming-today: ~2 hours ahead.
const upcomingTodayState = computed<FeaturedState>(() => {
  const match = shift(baseMatch.value, 2 * 3600 * 1000)
  return { kind: 'upcoming-today', match, msUntilKickoff: 2 * 3600 * 1000 }
})

// live-single: synthesize a live status (no score — daily-refresh data can't
// honestly report live scores, so the card now renders the "playing now" text).
const liveSingleState = computed<FeaturedState>(() => {
  const match: Match = { ...clone(baseMatch.value), status: 'live' }
  return { kind: 'live-single', match }
})

// live-multiple: take three different fixture matches.
const liveMultipleState = computed<FeaturedState>(() => {
  const picks = [
    fixtureById.value['wc2026-g-a-01'],
    fixtureById.value['wc2026-g-b-01'],
    fixtureById.value['wc2026-g-d-01'],
  ].filter((m): m is Match => m !== undefined)
  return { kind: 'live-multiple', count: picks.length, matches: picks }
})

// upcoming-future: ~3 days ahead.
const upcomingFutureState = computed<FeaturedState>(() => {
  const match = shift(baseMatch.value, 3 * 86_400 * 1000 + 7 * 3600 * 1000)
  return { kind: 'upcoming-future', match, msUntilKickoff: 3 * 86_400 * 1000 + 7 * 3600 * 1000 }
})

const tournamentOverState: FeaturedState = { kind: 'tournament-over' }

// Sample match cards: scheduled / live (no score, by design) / finished /
// finished on penalties / postponed.
const sampleMatches = computed<readonly Match[]>(() => {
  const a = fixtureById.value['wc2026-g-a-01']
  const b = fixtureById.value['wc2026-g-b-01']
  const c = fixtureById.value['wc2026-g-c-01']
  const d = fixtureById.value['wc2026-g-d-01']
  if (a === undefined || b === undefined || c === undefined || d === undefined) return []
  return [
    { ...clone(a), status: 'scheduled' },
    { ...clone(b), status: 'live' },
    { ...clone(c), status: 'finished', score: { home: 3, away: 0 } },
    {
      ...clone(d),
      status: 'finished',
      score: { home: 1, away: 1 },
      penalties: { home: 5, away: 4 },
    },
    { ...clone(d), status: 'postponed' },
  ]
})

// Standalone countdown target ~30 minutes from now.
const standaloneCountdownTarget = computed(() => now.value + 30 * 60 * 1000)

// MatchesList sample: shift 4 fixture matches to TODAY at different hours so
// the today-filter renders them. Mix statuses for visual variety.
const matchesListSample = computed<readonly Match[]>(() => {
  const a = fixtureById.value['wc2026-g-a-01']
  const b = fixtureById.value['wc2026-g-b-01']
  const c = fixtureById.value['wc2026-g-c-01']
  const d = fixtureById.value['wc2026-g-d-01']
  if (a === undefined || b === undefined || c === undefined || d === undefined) return []
  const startOfTodayLocal = new Date(now.value)
  startOfTodayLocal.setHours(0, 0, 0, 0)
  const base = startOfTodayLocal.getTime()
  const at = (hour: number): string => new Date(base + hour * 3600 * 1000).toISOString()
  return [
    { ...clone(a), utcKickoff: at(12), status: 'finished', score: { home: 1, away: 0 } },
    { ...clone(b), utcKickoff: at(15), status: 'finished', score: { home: 2, away: 2 } },
    { ...clone(c), utcKickoff: at(19), status: 'scheduled' },
    { ...clone(d), utcKickoff: at(22), status: 'scheduled' },
  ]
})

// DaySelector preview: stub `selectedYMD` to a non-today YMD inside the
// tournament window so the active-chip styling is observable in
// isolation. The actual selectDay flow is owned by MainView; the
// preview just demonstrates the component shell.
const previewSelectedYMD = ref<string | null>('2026-06-15')

function onPreviewDaySelect(ymd: string): void {
  previewSelectedYMD.value = ymd
}

function backToMain(event: Event): void {
  event.preventDefault()
  navigate('main')
}
</script>

<template>
  <div :class="$style.view">
    <header :class="$style.pageHeader">
      <h1 :class="$style.pageTitle">{{ t('preview.page.title') }}</h1>
      <p :class="$style.pageIntro">{{ t('preview.page.intro') }}</p>
    </header>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">Featured · upcoming-today</code>
        <p :class="$style.sectionDescription">
          {{ t('preview.featured.upcomingToday.description') }}
        </p>
      </div>
      <FeaturedCard :state="upcomingTodayState" :now="now">
        <template #notify-cta>
          <EnableNotificationsButton />
        </template>
      </FeaturedCard>
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">Featured · live-single</code>
        <p :class="$style.sectionDescription">
          {{ t('preview.featured.liveSingle.description') }}
        </p>
      </div>
      <FeaturedCard :state="liveSingleState" :now="now">
        <template #notify-cta>
          <EnableNotificationsButton />
        </template>
      </FeaturedCard>
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">Featured · live-multiple</code>
        <p :class="$style.sectionDescription">
          {{ t('preview.featured.liveMultiple.description') }}
        </p>
      </div>
      <FeaturedCard :state="liveMultipleState" :now="now" />
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">Featured · upcoming-future</code>
        <p :class="$style.sectionDescription">
          {{ t('preview.featured.upcomingFuture.description') }}
        </p>
      </div>
      <FeaturedCard :state="upcomingFutureState" :now="now">
        <template #notify-cta>
          <EnableNotificationsButton />
        </template>
      </FeaturedCard>
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">Featured · tournament-over</code>
        <p :class="$style.sectionDescription">
          {{ t('preview.featured.tournamentOver.description') }}
        </p>
      </div>
      <FeaturedCard :state="tournamentOverState" :now="now" />
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">MatchCard · all states</code>
        <p :class="$style.sectionDescription">{{ t('preview.section.matchCard') }}</p>
      </div>
      <div :class="$style.sectionTitle">
        <h2>{{ t('list.title') }}</h2>
        <span :class="$style.sectionCount">{{ t('list.count', { n: sampleMatches.length }) }}</span>
      </div>
      <ul :class="$style.matchList">
        <MatchCard v-for="match in sampleMatches" :key="match.id" :match="match" :now="now" />
      </ul>
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">MatchesList · today</code>
        <p :class="$style.sectionDescription">{{ t('preview.section.matchesList') }}</p>
      </div>
      <MatchesList :matches="matchesListSample" :now="now" />
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">DaySelector · 39 days</code>
        <p :class="$style.sectionDescription">{{ t('preview.section.daySelector') }}</p>
      </div>
      <DaySelector
        :matches="matchesListSample"
        :selected-y-m-d="previewSelectedYMD"
        :now="now"
        @select="onPreviewDaySelect"
      />
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionHeader">
        <code :class="$style.sectionId">Countdown · standalone</code>
        <p :class="$style.sectionDescription">{{ t('preview.section.countdown') }}</p>
      </div>
      <div :class="$style.countdownStandalone">
        <Countdown :target-ms="standaloneCountdownTarget" />
      </div>
    </section>

    <footer :class="$style.footer">
      <a :class="$style.backLink" href="#" @click="backToMain">
        &larr; {{ t('nav.backToMain') }}
      </a>
    </footer>
  </div>
</template>

<style module>
.view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.pageHeader {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 4px;
}

.pageTitle {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.pageIntro {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.4;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sectionHeader {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 4px;
}

.sectionId {
  display: inline-block;
  align-self: flex-start;
  background: var(--bg-pill);
  color: var(--text-base);
  font-family: 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
}

.sectionDescription {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.sectionTitle {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 4px;
}

.sectionTitle h2 {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.sectionCount {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.matchList {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.countdownStandalone {
  display: flex;
  justify-content: center;
  padding: 24px 0;
  background: var(--bg-featured);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.footer {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
}

.backLink {
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

.backLink:hover,
.backLink:focus-visible {
  color: var(--text-strong);
  background: var(--bg-pill);
}

.backLink:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
