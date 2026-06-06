<script setup lang="ts">
// EnableNotificationsButton — the gated CTA (design.md §12.3) that sits in
// the featured-card `notify-cta` slot. Renders different surfaces per
// permission state (specs/notifications.md §3 + AC-1/2/3):
//  - 'unsupported' → nothing in the DOM (no notification API to call).
//  - 'idle'        → interactive button that triggers requestPermission().
//  - 'requesting'  → disabled button while the native prompt is open.
//  - 'granted'     → calm confirmation pill (non-interactive, aria-live).
//  - 'denied'      → passive title + hint, NOT a button (browsers
//                    permanently deny after 2 rejections; we MUST NOT tempt
//                    the user into another rejection cycle).
//
// Visual contract: matches the prior FeaturedCard inline `.cta-notify`
// styling (rounded pill, semi-transparent over the featured surface). All
// colors via tokens; the `var(--text-on-featured)` family is owned by the
// featured surface in §13.1.
import { useNotifications } from '@/notifications/composables/useNotifications'
import { useI18n } from '@/shared/i18n/useI18n'

const { permission, requestPermission } = useNotifications()
const { t } = useI18n()

function onClick(): void {
  void requestPermission()
}
</script>

<template>
  <template v-if="permission === 'idle'">
    <button :class="$style.cta" type="button" :aria-pressed="false" @click="onClick">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {{ t('notifications.cta.idle') }}
    </button>
  </template>

  <template v-else-if="permission === 'requesting'">
    <button :class="$style.cta" type="button" disabled :aria-pressed="true">
      {{ t('notifications.cta.requesting') }}
    </button>
  </template>

  <template v-else-if="permission === 'granted'">
    <div :class="[$style.cta, $style.calm]" aria-live="polite">
      {{ t('notifications.cta.granted') }}
    </div>
  </template>

  <template v-else-if="permission === 'denied'">
    <div :class="$style.denied" role="note">
      <p :class="$style.deniedTitle">{{ t('notifications.cta.denied.title') }}</p>
      <p :class="$style.deniedHint">{{ t('notifications.cta.denied.hint') }}</p>
    </div>
  </template>
</template>

<style module>
.cta {
  width: 100%;
  background: color-mix(in srgb, var(--text-on-featured) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-featured) 14%, transparent);
  color: var(--text-on-featured);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 13px 16px;
  border-radius: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition:
    background 120ms ease,
    transform 120ms ease;
  position: relative;
  backdrop-filter: blur(8px);
}

.cta:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text-on-featured) 10%, transparent);
  border-color: color-mix(in srgb, var(--text-on-featured) 18%, transparent);
  transform: translateY(-1px);
}

.cta:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cta:disabled {
  cursor: progress;
  opacity: 0.7;
}

.cta svg {
  width: 14px;
  height: 14px;
}

.calm {
  cursor: default;
}

.denied {
  width: 100%;
  background: color-mix(in srgb, var(--text-on-featured) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-featured) 10%, transparent);
  color: var(--text-on-featured);
  border-radius: 14px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.deniedTitle {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-on-featured);
}

.deniedHint {
  font-size: 12px;
  color: var(--text-on-featured-muted);
  line-height: 1.4;
}
</style>
