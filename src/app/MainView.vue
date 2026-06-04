<script setup lang="ts">
// MainView. Renders the featured next-up / live card driven by the singleton
// data layer (`useMatches`), the singleton tick (`useNow`), and the pure
// state selector wrapped by `useFeatured`.
//
// Three branches:
//  - 'idle' | 'loading'  → calm "loading matches" surface.
//  - 'ready'             → `<FeaturedCard>` with the computed state.
//  - 'error'             → calm "couldn't load" surface (full degraded/error
//                          UI lands in the B-2 remainder).
//
// The matches list under the featured slot is intentionally NOT here yet —
// `MatchesList` (T8.2) is deferred to the B-2 remainder.
import { useFeatured } from '@/featured/composables/useFeatured'
import FeaturedCard from '@/featured/ui/FeaturedCard.vue'
import { useMatches } from '@/matches/composables/useMatches'
import { useI18n } from '@/shared/i18n/useI18n'
import { useNow } from '@/shared/time/useNow'
import { useRoute } from '@/app/router'

const { t } = useI18n()
const { matches, status } = useMatches()
const { featured } = useFeatured(matches)
const { now } = useNow()
const { navigate } = useRoute()

function openGallery(event: Event): void {
  event.preventDefault()
  navigate('preview')
}
</script>

<template>
  <div :class="$style.view">
    <section v-if="status === 'idle' || status === 'loading'" :class="$style.message">
      <h1 :class="$style.title">{{ t('main.loading.title') }}</h1>
      <p :class="$style.body">{{ t('main.loading.body') }}</p>
    </section>

    <FeaturedCard v-else-if="status === 'ready'" :state="featured" :now="now" />

    <section v-else :class="$style.message">
      <h1 :class="$style.title">{{ t('main.error.title') }}</h1>
      <p :class="$style.body">{{ t('main.error.body') }}</p>
    </section>

    <footer :class="$style.footer">
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

.footer {
  display: flex;
  justify-content: center;
  padding: 4px 0 24px;
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
