<script setup lang="ts">
// MatchesList — renders the list of today's matches under the featured
// card. Filters cancelled matches per specs/matches.md AC-6, excludes
// non-today entries per AC-7, and sorts by `byKickoffThenId` per AC-3.
//
// Pure presentational composition over `MatchCard`; the empty-state copy
// covers AC-8 ("zero matches today" surface).
import { computed } from 'vue'
import type { Match } from '@/matches/domain/match'
import MatchCard from '@/matches/ui/MatchCard.vue'
import { isToday } from '@/matches/domain/today'
import { byKickoffThenId } from '@/matches/domain/sort'
import { useI18n } from '@/shared/i18n/useI18n'

const props = defineProps<{ matches: readonly Match[]; now: number }>()

const { t } = useI18n()

const todays = computed<readonly Match[]>(() => {
  const filtered = props.matches.filter(
    (m) => m.status !== 'cancelled' && isToday(m.utcKickoff, props.now),
  )
  return [...filtered].sort(byKickoffThenId)
})
</script>

<template>
  <section :class="$style.section">
    <div :class="$style.header">
      <h2 :class="$style.title">{{ t('list.title') }}</h2>
      <span :class="$style.count">{{ t('list.count', { n: todays.length }) }}</span>
    </div>

    <ul v-if="todays.length > 0" :class="$style.list">
      <MatchCard v-for="match in todays" :key="match.id" :match="match" :now="now" />
    </ul>

    <div v-else :class="$style.empty" role="status">
      <p :class="$style.emptyText">{{ t('list.empty') }}</p>
    </div>
  </section>
</template>

<style module>
.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 4px;
}

.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.count {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.empty {
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 28px 16px;
  text-align: center;
}

.emptyText {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
}
</style>
