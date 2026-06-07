<script setup lang="ts">
// Per-match calendar export (design.md §18). Click → builds an RFC-5545
// ICS body for the single match and triggers a Blob download. The user's
// OS opens the file with their default calendar app (Google, Apple,
// Outlook, Thunderbird, Proton). Pure client-side: zero network calls.
//
// The locale is resolved at CLICK time (not at render time) by calling
// `useI18n()` synchronously inside the handler. A user who switches
// languages after rendering still gets a localized SUMMARY on next click.
import { computed } from 'vue'
import type { Match } from '@/matches/domain/match'
import { buildMatchIcs, type IcsRenderContext } from '@/matches/domain/ics'
import { triggerIcsDownload } from '@/matches/domain/download'
import { STAGE_KEYS } from '@/matches/i18n/stage-labels'
import { useI18n } from '@/shared/i18n/useI18n'
import { getNow } from '@/shared/time/now'

const props = defineProps<{ match: Match }>()

const { t, country } = useI18n()

const teamAName = computed(() => country(props.match.teamA.iso) ?? props.match.teamA.name)
const teamBName = computed(() => country(props.match.teamB.iso) ?? props.match.teamB.name)

const ariaLabel = computed(
  () => `${t('calendar.cta.add')} · ${teamAName.value} vs ${teamBName.value}`,
)

function onClick(): void {
  const ctx: IcsRenderContext = {
    resolveTeamName: (iso, fb) => country(iso) ?? fb,
    resolveStageLabel: (stage) => t(STAGE_KEYS[stage]),
    appUrl: resolveAppUrl(),
  }
  const ics = buildMatchIcs(props.match, ctx, getNow())
  const filename = buildFilename(props.match)
  triggerIcsDownload(ics, filename)
}

function resolveAppUrl(): string {
  if (typeof window === 'undefined') return ''
  const base = import.meta.env.BASE_URL ?? '/'
  return window.location.origin + base
}

function buildFilename(match: Match): string {
  const date = match.utcKickoff.slice(0, 10)
  return `wc2026-${match.teamA.iso}-vs-${match.teamB.iso}-${date}.ics`
}
</script>

<template>
  <button :class="$style.button" type="button" :aria-label="ariaLabel" @click="onClick">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4M12 13v4M10 15h4" />
    </svg>
  </button>
</template>

<style module>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 120ms ease,
    color 120ms ease,
    border-color 120ms ease,
    transform 120ms ease;
}

.button:hover {
  background: var(--bg-pill);
  color: var(--text-strong);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.button svg {
  width: 14px;
  height: 14px;
}
</style>
