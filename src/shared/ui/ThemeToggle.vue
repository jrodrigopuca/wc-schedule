<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/shared/i18n/useI18n'
import { useTheme } from '@/shared/theme/useTheme'

const { current, setTheme } = useTheme()
const { t } = useI18n()

const isDark = computed(() => current.value === 'dark')

const ariaLabel = computed(() =>
  isDark.value ? t('theme.toggle.toLight') : t('theme.toggle.toDark'),
)

function toggle(): void {
  setTheme(isDark.value ? 'light' : 'dark')
}
</script>

<template>
  <button
    type="button"
    :class="$style.toggle"
    :aria-label="ariaLabel"
    :aria-pressed="isDark"
    @click="toggle"
  >
    <svg
      v-if="!isDark"
      :class="$style.icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
    <svg
      v-else
      :class="$style.icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>
</template>

<style module>
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-toggle);
  color: var(--text-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 8px 14px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background 200ms ease,
    color 200ms ease,
    border-color 200ms ease;
}

.toggle:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.icon {
  width: 14px;
  height: 14px;
}
</style>
