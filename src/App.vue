<script setup lang="ts">
// App shell. Routes to MainView ('/') or PreviewView ('#/preview').
import { computed } from 'vue'
import MainView from '@/app/MainView.vue'
import PreviewView from '@/app/PreviewView.vue'
import LocaleToggle from '@/shared/ui/LocaleToggle.vue'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import { useRoute } from '@/app/router'
import { APP_NAME } from '@/shared/types/app-name'

const { t } = useI18n()
const { current: route } = useRoute()

const isPreview = computed(() => route.value === 'preview')
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

      <PreviewView v-if="isPreview" />
      <MainView v-else />
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
