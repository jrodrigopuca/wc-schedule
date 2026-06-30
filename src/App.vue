<script setup lang="ts">
// App shell. Routes to MainView ('/'), PreviewView ('#/preview'), or
// BracketView ('#/bracket'). The bracket route gets a wider content shell so
// the knockout tree can print and scroll safely without affecting the compact
// day-to-day views.
import { computed } from 'vue'
import BracketView from '@/app/BracketView.vue'
import MainView from '@/app/MainView.vue'
import PreviewView from '@/app/PreviewView.vue'
import LocaleToggle from '@/shared/ui/LocaleToggle.vue'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import { ROUTE, useRoute } from '@/app/router'
import { APP_NAME } from '@/shared/types/app-name'

const { t } = useI18n()
const { current: route } = useRoute()

const isPreview = computed(() => route.value === ROUTE.PREVIEW)
const isBracket = computed(() => route.value === ROUTE.BRACKET)
</script>

<template>
  <div :class="[$style.shell, isBracket && $style.shellBracket]" :data-route="route">
    <main
      :class="[$style.main, isBracket ? $style.mainWide : $style.mainCompact]"
      data-app-main
      :data-shell-width="isBracket ? 'wide' : 'compact'"
    >
      <header :class="$style.header" data-app-header>
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
      <BracketView v-else-if="isBracket" />
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
  margin: 0 auto;
  padding: 28px 22px 64px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.mainCompact {
  max-width: 480px;
}

.mainWide {
  max-width: 1360px;
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

@media (min-width: 900px) {
  .mainWide {
    padding-inline: 28px;
  }
}

@media print {
  .shellBracket {
    min-height: auto;
    background: #fff;
  }

  .shellBracket .header {
    display: none;
  }

  .mainWide {
    max-width: none;
    margin: 0;
    padding: 0;
  }

  .mainCompact {
    max-width: none;
  }
}
</style>
