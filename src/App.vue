<script setup lang="ts">
// Component-preview shell. Replaced by FeaturedSection + MatchesList in T8.5/T8.2 (batch B-2).
import { computed, ref } from 'vue'
import fixtureData from '@/shared/fixture/matches.fixture.json'
import type { FeaturedState } from '@/featured/domain/featured-state'
import type { Match } from '@/matches/domain/match'
import FeaturedCard from '@/featured/ui/FeaturedCard.vue'
import Countdown from '@/featured/ui/Countdown.vue'
import MatchCard from '@/matches/ui/MatchCard.vue'
import LocaleToggle from '@/shared/ui/LocaleToggle.vue'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import { APP_NAME } from '@/shared/types/app-name'
import { getNow } from '@/shared/time/now'

const { t } = useI18n()

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

// Sample match cards: scheduled / live (no score, by design) / finished / postponed.
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
    { ...clone(d), status: 'postponed' },
  ]
})

// Standalone countdown target ~30 minutes from now.
const standaloneCountdownTarget = computed(() => now.value + 30 * 60 * 1000)
</script>

<template>
  <div :class="$style.shell">
    <main :class="$style.main">
      <header :class="$style.header">
        <div :class="$style.brand">
          <div :class="$style.mark">26</div>
          <div :class="$style.brandText">
            {{ APP_NAME }}
            <small>{{ t('header.subtitle') }}</small>
          </div>
        </div>
        <div :class="$style.headerToggles">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <section :class="$style.section">
        <div :class="$style.sectionTitle">
          <h2>Featured · upcoming-today</h2>
        </div>
        <FeaturedCard :state="upcomingTodayState" :now="now" />
      </section>

      <section :class="$style.section">
        <div :class="$style.sectionTitle">
          <h2>Featured · live-single</h2>
        </div>
        <FeaturedCard :state="liveSingleState" :now="now" />
      </section>

      <section :class="$style.section">
        <div :class="$style.sectionTitle">
          <h2>Featured · live-multiple</h2>
        </div>
        <FeaturedCard :state="liveMultipleState" :now="now" />
      </section>

      <section :class="$style.section">
        <div :class="$style.sectionTitle">
          <h2>Featured · upcoming-future</h2>
        </div>
        <FeaturedCard :state="upcomingFutureState" :now="now" />
      </section>

      <section :class="$style.section">
        <div :class="$style.sectionTitle">
          <h2>Featured · tournament-over</h2>
        </div>
        <FeaturedCard :state="tournamentOverState" :now="now" />
      </section>

      <section :class="$style.section">
        <div :class="$style.sectionTitle">
          <h2>{{ t('list.title') }}</h2>
          <span :class="$style.sectionCount">{{
            t('list.count', { n: sampleMatches.length })
          }}</span>
        </div>
        <ul :class="$style.matchList">
          <MatchCard v-for="match in sampleMatches" :key="match.id" :match="match" :now="now" />
        </ul>
      </section>

      <section :class="$style.section">
        <div :class="$style.sectionTitle">
          <h2>Countdown standalone</h2>
        </div>
        <div :class="$style.countdownStandalone">
          <Countdown :target-ms="standaloneCountdownTarget" />
        </div>
      </section>
    </main>
  </div>
</template>

<style module>
.shell {
  position: relative;
  min-height: 100vh;
  background-color: var(--bg-page);
}

.main {
  max-width: 480px;
  margin: 0 auto;
  padding: 28px 22px 64px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.headerToggles {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.mark {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
  display: grid;
  place-items: center;
  color: var(--text-inverse);
  font-weight: 800;
  font-size: 15px;
  box-shadow: var(--shadow-sm);
}

.brandText {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-strong);
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.brandText small {
  display: block;
  font-weight: 500;
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

/* On narrow viewports the brand may wrap above the toggles so the pills do
   not get crushed against the mark. flex-wrap on .header handles it. */
@media (max-width: 380px) {
  .brand {
    flex-basis: 100%;
  }
  .headerToggles {
    flex-basis: 100%;
    justify-content: flex-end;
  }
}
</style>
