<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/shared/i18n/useI18n'
import type { Locale } from '@/shared/i18n/types'

const { current, setLocale, t } = useI18n()

const isEs = computed(() => current.value === 'es')

// aria-label reflects the action the next click will perform — same shape as
// ThemeToggle: announce the destination, not the current state.
const ariaLabel = computed(() => (isEs.value ? t('locale.toggle.toEn') : t('locale.toggle.toEs')))

function select(locale: Locale): void {
  if (current.value === locale) return
  setLocale(locale)
}
</script>

<template>
  <div :class="$style.toggle" role="group" :aria-label="ariaLabel">
    <button
      type="button"
      :class="[$style.segment, isEs ? $style.segmentActive : null]"
      :aria-pressed="isEs"
      :aria-label="t('locale.toggle.toEs')"
      @click="select('es')"
    >
      ES
    </button>
    <button
      type="button"
      :class="[$style.segment, !isEs ? $style.segmentActive : null]"
      :aria-pressed="!isEs"
      :aria-label="t('locale.toggle.toEn')"
      @click="select('en')"
    >
      EN
    </button>
  </div>
</template>

<style module>
.toggle {
  display: inline-flex;
  align-items: center;
  background: var(--bg-toggle);
  color: var(--text-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 3px;
  font-family: inherit;
  box-shadow: var(--shadow-sm);
  transition:
    background 200ms ease,
    border-color 200ms ease;
}

.segment {
  appearance: none;
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  padding: 5px 12px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 120ms ease;
}

.segment:hover:not(.segmentActive) {
  color: var(--text-base);
}

.segment:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.segmentActive {
  background: var(--bg-pill);
  color: var(--text-strong);
  box-shadow: var(--shadow-sm);
}
</style>
