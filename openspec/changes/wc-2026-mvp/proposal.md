# Proposal — wc-2026-mvp

## 1. Metadata

- **Change name:** wc-2026-mvp
- **Status:** draft
- **Owner:** jrodrigopuca@gmail.com
- **Date:** 2026-06-03
- **Related artifacts:** `specs/`, `design.md`, `tasks.md` (to be authored)

## 2. Why

The FIFA World Cup 2026 is a time-bounded, high-attention event. Casual viewers repeatedly ask the same two questions: "is there a match right now?" and "when is the next one in my time?". General sports apps answer this with noise — ads, login walls, irrelevant leagues, and timezones that default to the publisher's region.

There is room for a focused, single-purpose SPA that answers those two questions in under a second, works offline once visited, and reminds the user 15 minutes before each match without requiring an account or a backend.

The window of usefulness is short (the tournament itself), so the product must be cheap to operate, trivial to host, and resilient to upstream data outages.

## 3. What

A small installable PWA that, on open, shows:

- A **featured slot** at the top, which adapts to one of five states:
  1. **Single live match** — featured card with an "EN VIVO" eyebrow and a TEXTUAL in-progress indicator (e.g. "se está jugando ahora"). No score is rendered: the daily-refresh pipeline cannot honestly report a real-time score (see §5 non-goals).
  2. **Multiple simultaneous live matches** — a "hay N partidos en vivo" summary state; the list below remains the primary surface.
  3. **No live, upcoming today** — the next-to-start match with a live countdown (HH:MM:SS until kickoff).
  4. **No matches today** — the next closest upcoming match on any future day.
  5. **Tournament over** — an "el mundial ha terminado" terminal state.
- A **list of today's matches** in the user's local timezone (resolved client-side). Live rows display the "EN VIVO" badge ONLY — no in-flight score. Finished rows display the final score once the next daily refresh backfills it.
- A path to **install the PWA** and to **enable local notifications**, which fire 15 minutes before each match (fixed value for MVP).
- **Per-match calendar export**: clicking a small icon on any match row downloads a standards-based `.ics` file that imports into Google Calendar, Apple Calendar, Outlook, or any RFC 5545-compliant calendar app. Universal, privacy-friendly, no third-party redirects.
- **Prominent team identity** in the featured slot — circular flag medallions, country names, and a soft tint of each team's colors — to evoke the feeling of a derby rather than a generic schedule entry.
- **Bilingual UI (Spanish + English).** Locale is auto-detected from `navigator.language` on first load; the user can override via a UI toggle, and the override persists in `localStorage`. Clearing the override returns to browser-driven detection.

There is no login and no settings beyond install/notification permission, theme override, and language override. The main app is a single route (`/`); a secondary `/preview` route exposes a component gallery for QA, design review, and onboarding.

## 4. Goals

- Answer "is there a match now?" and "when is the next one (locally)?" in a single glance.
- Work offline after the first visit.
- Deliver a reliable 15-minute pre-match local notification, opt-in via user gesture.
- Operate at zero infrastructure cost (static hosting only).
- Survive upstream data failures without breaking the UI.
- Stay correct across timezones without server-side rendering.
- Adapt the visual presentation to the user's OS color-scheme preference (light/dark), with a manual override that persists.
- Support Spanish and English UI, with auto-detection from the browser locale and a persistent manual override.
- Provide a permanent component gallery at `/preview` to keep design / QA / dev review fast.
- Let users add specific matches to their personal calendar with one click, using a universal `.ics` format that works with every standards-compliant calendar app.

## 5. Non-goals (out of scope for MVP)

- Favorites, team filters, predictions, group-stage standings.
- Server-driven push notifications (only local scheduled notifications).
- Real-time score updates via a live API.
- **Real-time live scores** — OUT OF SCOPE. Live state is communicated TEXTUALLY because the daily-refresh pipeline cannot honestly report scores in flight. Finished-match scores DO appear in the list once the next daily refresh backfills them.
- User accounts, profiles, or any persisted server state.
- Languages beyond Spanish and English for MVP.
- Configurable notification lead time (locked at 15 minutes for MVP).
- Bespoke per-team theming beyond the soft background-color tint used in the featured slot.
- Full Storybook-style component documentation tooling — the in-app gallery covers the MVP need.

## 6. Constraints

- **Hosting:** GitHub Pages, static only. No server runtime.
- **Data source:** football-data.org free tier — rate-limited; cannot be called from the client.
- **Secrets:** the API token MUST live exclusively in GitHub Actions secrets. The client bundle MUST NOT contain it.
- **Timezone:** resolved on the client via `Intl.DateTimeFormat` and `toLocaleString`. UTC stored, local rendered.
- **Notifications:** Web Notifications API, permission requested only after a user gesture.
- **Architecture:** Screaming Architecture; domain code must not depend on Vue APIs.
- **Tooling:** Vue 3 + TS strict + Vite + `vite-plugin-pwa` + CSS Modules. No Pinia.
- **Theming:** MUST work without runtime theme-flicker (FOUC) on cold load.
- **i18n:** All user-facing strings MUST be reachable via the i18n message table; hardcoded strings in components are a correctness defect. No heavy i18n framework — custom solution sized for ~32 keys.

## 7. Approach (high-level)

- **Adaptive data source via Adapter Pattern.** A single `MatchSource` port with two implementations: a bundled fixture (`manual`) and the daily-refreshed static JSON (`remote`). An env flag `VITE_DATA_SOURCE` selects which adapter the composition root wires in. The fixture also acts as a last-resort fallback if the remote JSON fails to load at runtime.
- **Daily data pipeline.** A GitHub Actions cron job calls football-data.org with the secret token, transforms the response into the project's `Match` shape, and commits the result to `public/data/matches.json`. The client never sees the upstream API.
- **PWA + local notifications.** `vite-plugin-pwa` generates the service worker (auto-update). Notifications are scheduled from the in-memory match list at app boot, using the Web Notifications API plus `setTimeout` (with `showTrigger` where supported).
- **Computed live state.** "Live" is derived purely on the client from a match's start time and a ~110-minute window. No live endpoint is consumed.
- **Domain isolation.** `src/matches`, `src/featured`, `src/notifications`, `src/shared`, `src/app`. Pure TS in the middle, Vue at the edges via composables.

Implementation specifics (file layout, type shapes, exact thresholds, error handling) belong in `design.md`, not here.

## 8. Success criteria

- On a cold load with network, the user sees the correct featured state and today's list within the first paint after data fetch.
- On a repeat load offline, the app still renders the last-known matches and the correct computed live/upcoming state.
- The user can install the PWA from the browser's install affordance.
- After granting notification permission, a notification is reliably delivered ~15 minutes before each scheduled match while the app or its service worker is alive.
- The five featured-slot states are each reachable and visually distinct.
- The same UTC kickoff renders correctly in at least three distinct local timezones without code changes.
- The deployed bundle contains no football-data.org token (verifiable by inspecting the built artifact).
- The daily GitHub Actions job updates `public/data/matches.json` and the deployed site reflects it within one deploy cycle.

## 9. Risks & open questions

- **football-data.org rate limits and availability.** Free-tier quotas may be exceeded or the endpoint may degrade during peak match days. Mitigation: a tournament-aware refresh schedule (every 24h during the tournament, every 48h in a configurable lead-in / tail-off window, and a no-op outside both windows), backed by a retained history of recent successful snapshots so a failed run never leaves the app worse than its previous good state.
- **Timezone edge cases.** DST transitions, half-hour offsets (e.g. some regions), and devices with misconfigured clocks can shift the "today" boundary. Need explicit handling in `design.md`.
- **Notification reliability.** Browsers throttle or kill `setTimeout` when tabs are backgrounded; `Notification.showTrigger` is not universally supported. The 15-minute guarantee is best-effort, not contractual.
- **Notification permission UX.** Requesting permission too early gets denied permanently. Need a gated, explained prompt tied to a user action.
- **Simultaneous live matches.** Showing "hay N partidos en vivo" hides individual scores in the featured slot; open question whether to cycle through them or keep a single static summary. To be resolved in `design.md`.
- **Tournament-over detection.** Requires a definitive "end of competition" signal. Open question: derive from the last scheduled match's end time, or hardcode a tournament end date?
- **Schema drift.** football-data.org may change response shapes between now and 2026. The transform step in the GH Action is the seam where breakage will surface first.
- **Service-worker cache invalidation.** After a data refresh, users on stale caches may see yesterday's matches until the SW updates. Strategy needs to be defined in `design.md`.
- **No real-time score is a deliberate trade-off.** Users may expect a live scoreboard; the app intentionally communicates liveness via text only because the daily-cron + static-JSON architecture cannot honestly source in-flight scores without polling. The GH Action's daily refresh CAN backfill finished-match scores once the match has ended, so post-match scores DO appear in the list view; only in-flight scores are absent. Documented and accepted for MVP.

## 10. Dependencies

This proposal expects the following SDD artifacts to follow, in order:

- `openspec/changes/wc-2026-mvp/specs/` — capability specs (matches, featured, notifications, pwa, data-source).
- `openspec/changes/wc-2026-mvp/design.md` — technical design: adapter interfaces, type shapes, scheduling strategy, SW caching, timezone handling.
- `openspec/changes/wc-2026-mvp/tasks.md` — task breakdown derived from specs + design.

Per `conventions.md` §9, `specs` and `design` may be authored in parallel; `tasks` requires both.

**Deploy note (added during Phase 12 deploy batch):** the deploy target is GitHub Pages using the NATIVE Pages deployment (`actions/deploy-pages@v4`), not the third-party gh-pages branch flow. The Vite `base` is locked to `/wc-schedule/` so all assets resolve under that prefix; the PWA manifest's `start_url` and `scope` mirror it. Icons are generated from a single SVG source (`public/icon-source.svg`) via `@vite-pwa/assets-generator` and emitted to `public/` so the build pipeline ships them at the deploy root. The Phase 11 daily-refresh GitHub Action is intentionally deferred — the bundled fixture covers the launch window, and `RemoteSource` falls back to the fixture if `public/data/matches.json` is absent.
