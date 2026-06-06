<script setup lang="ts">
// MainView. Renders the featured card + today's matches list driven by the
// singleton data layer (`useMatches`) and tick (`useNow`). The notify CTA is
// injected into FeaturedCard via the `notify-cta` slot so the featured-domain
// component stays decoupled from notifications-domain code.
import { computed } from 'vue'
import { useFeatured } from '@/featured/composables/useFeatured'
import FeaturedCard from '@/featured/ui/FeaturedCard.vue'
import { useMatches } from '@/matches/composables/useMatches'
import MatchesList from '@/matches/ui/MatchesList.vue'
import EnableNotificationsButton from '@/notifications/ui/EnableNotificationsButton.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import { useNow } from '@/shared/time/useNow'
import { useRoute } from '@/app/router'

const { t } = useI18n()
const { matches, status, sourceName } = useMatches()
const { featured } = useFeatured(matches)
const { now } = useNow()
const { navigate } = useRoute()

const hasData = computed(() => status.value === 'ready' || status.value === 'degraded')

const staleMessage = computed(() => {
  if (status.value !== 'degraded') return null
  if (sourceName.value === 'history') return t('data.stale.history')
  if (sourceName.value === 'manual') return t('data.stale.fixture')
  return null
})

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

    <template v-else-if="hasData">
      <FeaturedCard :state="featured" :now="now">
        <template #notify-cta>
          <EnableNotificationsButton />
        </template>
      </FeaturedCard>

      <MatchesList :matches="matches" :now="now" />
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
