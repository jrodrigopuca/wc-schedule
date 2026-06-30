<script setup lang="ts">
import { computed } from 'vue'
import { buildBracketModel } from '@/bracket/domain/buildBracketModel'
import BracketTree from '@/bracket/ui/BracketTree.vue'
import { useMatches } from '@/matches/composables/useMatches'
import { useI18n } from '@/shared/i18n/useI18n'
import { useNow } from '@/shared/time/useNow'

interface DataIndicator {
  readonly kind: 'fresh' | 'stale'
  readonly label: string
}

const { t } = useI18n()
const { matches, sourceName, status } = useMatches()
const { now } = useNow()

const bracketModel = computed(() => buildBracketModel(matches.value))
const hasBracketMatches = computed(() =>
  bracketModel.value.rounds.some((round) =>
    round.matches.some((roundMatch) => roundMatch.match !== null),
  ),
)

const isLoading = computed(() => status.value === 'idle' || status.value === 'loading')
const isReady = computed(
  () => (status.value === 'ready' || status.value === 'degraded') && hasBracketMatches.value,
)
const isEmpty = computed(
  () => (status.value === 'ready' || status.value === 'degraded') && !hasBracketMatches.value,
)

const dataIndicator = computed<DataIndicator | null>(() => {
  if (!isReady.value) return null
  if (status.value === 'degraded') {
    if (sourceName.value === 'history') return { kind: 'stale', label: t('data.stale.history') }
    return { kind: 'stale', label: t('data.stale.fixture') }
  }
  return { kind: 'fresh', label: t('data.fresh') }
})

function printBracket(): void {
  if (!isReady.value || typeof window === 'undefined') return
  window.print()
}
</script>

<template>
  <div :class="$style.view">
    <header :class="$style.pageHeader">
      <div :class="$style.copy">
        <h1 :class="$style.title">{{ t('bracket.page.title') }}</h1>
        <p :class="$style.subtitle">{{ t('bracket.page.subtitle') }}</p>
      </div>

      <div :class="$style.controls">
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
        <button v-if="isReady" type="button" :class="$style.printButton" @click="printBracket">
          {{ t('bracket.print.cta') }}
        </button>
      </div>
    </header>

    <section v-if="isLoading" :class="$style.message">
      <h2 :class="$style.messageTitle">{{ t('main.loading.title') }}</h2>
      <p :class="$style.messageBody">{{ t('main.loading.body') }}</p>
    </section>

    <section v-else-if="isReady" :class="$style.treeShell">
      <BracketTree :model="bracketModel" :now="now" />
    </section>

    <section v-else-if="isEmpty" :class="$style.message">
      <h2 :class="$style.messageTitle">{{ t('bracket.empty.title') }}</h2>
      <p :class="$style.messageBody">{{ t('bracket.empty.body') }}</p>
    </section>

    <section v-else :class="$style.message">
      <h2 :class="$style.messageTitle">{{ t('bracket.error.title') }}</h2>
      <p :class="$style.messageBody">{{ t('bracket.error.body') }}</p>
    </section>
  </div>
</template>

<style module>
.view {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
}

.pageHeader {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-strong);
  letter-spacing: -0.02em;
}

.subtitle {
  max-width: 60ch;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-muted);
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.printButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-card);
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    border-color 120ms ease;
}

.printButton:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.statusDot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
  cursor: help;
}

.statusDotFresh {
  background-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.statusDotStale {
  background-color: #f59e0b;
  box-shadow: 0 0 0 3px color-mix(in srgb, #f59e0b 18%, transparent);
}

.treeShell {
  border-radius: calc(var(--radius-lg, 20px) + 2px);
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  border: 1px solid var(--border);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.message {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 56px 16px 28px;
  text-align: center;
}

.messageTitle {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.messageBody {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-muted);
}

@media (min-width: 768px) {
  .pageHeader {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .controls {
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .treeShell {
    padding: 20px;
  }
}

@media print {
  /* Single-sheet bracket: the cuadro is wide (5 columns), so landscape A4
     with tight margins gives the most horizontal room. Combined with the
     compact print `--slot-size` in BracketTree, the whole tree targets one
     page. @page is document-level even inside a CSS module. */
  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  .view {
    gap: 0;
  }

  .pageHeader,
  .controls,
  .subtitle {
    display: none;
  }

  .treeShell {
    padding: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
  }
}
</style>
