# WC Schedule

Static SPA for the FIFA World Cup 2026 — shows today's matches + a featured "next match" card with countdown + PWA local notifications 15 minutes before kickoff.

## Routes

- `/` — main app: featured card (next-up / live) + today's matches list.
- `/#/preview` — component gallery: every `FeaturedCard` state variant + `MatchCard` examples + standalone `Countdown`. Permanent QA/design/onboarding aid.

## Stack

Vue 3 + TypeScript strict + Vite + CSS Modules + `vite-plugin-pwa`. No Pinia, no vue-router, no vue-i18n — composables only. Daily data refresh via GitHub Actions; no live-score polling.
