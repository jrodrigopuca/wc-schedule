# Tasks — wc-2026-mvp

## 1. Metadata

- **Change name:** wc-2026-mvp
- **Status:** planned
- **Date:** 2026-06-03
- **Dependencies:** requires `proposal.md` + all five `specs/*.md` + `design.md` (all present).
- **Starting state:** empty repository (only `README.md` + `openspec/`). Every line of code is yet to be written.
- **PR convention:** each task ID should correspond to a single PR/branch. Conventional Commits per `conventions.md` §8 (no AI co-author trailers).
- **Estimates legend:** **S** ≈ half a day, **M** ≈ one day, **L** ≈ two days. Anything longer MUST be split.

## 2. Critical path

The five tasks below block the largest fan-out of downstream work. Prioritize them — they unblock parallel streams.

1. **T0.1** — Vite + Vue + TS strict bootstrap (blocks literally everything).
2. **T2.1** — Domain type model (`Match`, `MatchStatus`, `Stage`, `Team`, `Score`, `FeaturedState`) (blocks T2.2, T3.*, T5.*, T8.*, T9.*).
3. **T2.2** — `matchListSchema` Zod validator (blocks T3.*, T4.1, T11.*).
4. **T3.1** — `MatchSource` port + `chooseSource` walker + `loadMatches` composition (blocks T3.2-3.4, T10.*).
5. **T5.1** — `selectFeaturedState` pure selector (blocks T8.4, T10.*).

## 3. Phases

### Phase 0 — Bootstrap

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T0.1 | Vite + Vue 3 + TS strict scaffold | `conventions.md` §1, §7 | `npm run dev` boots a hello-world Vue app on `localhost`; `tsc --noEmit` clean with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` on; `package.json` declares `"type": "module"`; Vite `base` set ready for GH Pages. | — | smoke: `npm run build` succeeds; type-check passes. | M |
| T0.2 | ESLint + Prettier config + `.editorconfig` | `conventions.md` §7 | Lint scripts in `package.json`; ESLint catches `any` and unused vars; Prettier formats `.vue`/`.ts`/`.css` consistently; pre-commit hook (husky + lint-staged) wired. | T0.1 | n/a — covered by `npm run lint` script | S |
| T0.3 | Screaming-Architecture folder skeleton | `conventions.md` §2, `design.md` §2 | Folders exist with `.gitkeep` placeholders: `src/app/`, `src/matches/{domain,ports,adapters,composables,ui}/`, `src/featured/{domain,composables,ui}/`, `src/notifications/{domain,ports,adapters,composables,ui}/`, `src/shared/{time,types,theme,flags,ui}/`, `src/sw/`; path aliases (`@/`) configured in `tsconfig.json` + `vite.config.ts`. | T0.1 | n/a | S |
| T0.4 | Vitest + Vue Test Utils + happy-dom setup | `conventions.md` §6, `design.md` §15 | `npm run test` runs and finds a placeholder pure-function test; `vitest.config.ts` resolves `@/` alias; happy-dom environment configured; coverage reporter wired (no threshold yet). | T0.1, T0.3 | sample test of `1 + 1 === 2` to prove the harness. | S |
| T0.5 | Playwright scaffold | `conventions.md` §6, `design.md` §15 | `npm run e2e` runs Playwright against `npm run preview`; one trivial spec asserts page `<title>`; CI config can be added later. | T0.1 | n/a — IS the test. | S |
| T0.6 | `vite-plugin-pwa` installed and minimally configured | `design.md` §9 | Plugin registered with `registerType: "autoUpdate"`; an SW is generated and registered in dev/preview; manifest stub points at neutral mid-tone `#16161D`. Icons placeholder for now (real icons in T12.4). | T0.1 | manual: open preview, confirm SW registers in DevTools. | S |

### Phase 1 — Theming & visual foundations

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T1.1 | CSS token layer (light + dark) | `specs/theming.md` §2, `design.md` §13.1 | `src/shared/ui/tokens.module.css` defines all color/spacing/typography custom properties for both themes; `:root` carries light; `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` carry dark; `color-scheme` declared per theme. | T0.3 | manual visual check; component snapshots in T8.* later. | M |
| T1.2 | Pre-paint inline script in `index.html` | `specs/theming.md` §5, `design.md` §13.2 | Inline `<script>` in `<head>` BEFORE any CSS link reads `localStorage.wc-theme` and applies `data-theme` attribute; `try`/`catch` around `localStorage`. | T1.1 | E2E (T12.2) verifies no FOUC across reloads with override. | S |
| T1.3 | Theme storage helpers | `specs/theming.md` §3.2, `design.md` §13.3 | `src/shared/theme/storage.ts` exports `readStoredTheme`, `writeStoredTheme`, `clearStoredTheme`; key `wc-theme`; only `"light"` or `"dark"` accepted. | T0.3 | unit: round-trip read/write/clear; rejects invalid stored values. | S |
| T1.4 | `useTheme()` composable | `specs/theming.md` §3, §4, `design.md` §13.4 | Module-scoped singleton state; `current` computed from `stored ?? OS`; `setTheme` writes + applies attribute; `clearOverride` removes attribute + storage; `matchMedia` listener wired and torn down on unmount. | T1.1, T1.3 | unit: 4 cases from `design.md` §15 (OS-honored, setTheme persistence, override-survives-reload, clearOverride returns to OS). | M |
| T1.5 | `ThemeToggle` component | `specs/theming.md` §3.2, §4 | A small button (icon or text) in the app header lets the user switch light/dark and clear override; reflects current theme; accessible label; focus ring respects token. | T1.4 | component: clicking toggles `data-theme`; clearing removes attribute. | S |
| T1.6 | Base typography + global reset stylesheet | `specs/theming.md` §6, `design.md` §13.1 | `src/shared/ui/global.css` sets `body` font, line-height, base spacing; uses tokens only; WCAG AA contrast verified against both theme backgrounds. | T1.1 | manual contrast check (axe DevTools or similar) — formal audit in T12.3. | S |

### Phase 2 — Domain & types

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T2.1 | Match domain types | `specs/matches.md` §2, §5, `design.md` §3 | `src/matches/domain/match.ts` exports `MatchStatus`, `Stage`, `Team`, `Score`, `Match` (all `readonly`, no `any`, optional fields use `?:` honoring `exactOptionalPropertyTypes`). | T0.3 | type-check only. | S |
| T2.2 | `matchListSchema` Zod validator | `specs/data-source.md` §2, `design.md` §5 | `src/matches/domain/match.schema.ts` exports `matchListSchema` and `ValidatedMatch`; compile-time assertion `ValidatedMatch extends Match` holds; `utcKickoff` requires trailing `Z`; `group` constrained to `/^[A-L]$/`. | T2.1 | unit: accepts a valid fixture; rejects missing `utcKickoff`, wrong status, bad stage, lowercase `z` suffix, illegal `group`. | M |
| T2.3 | `FeaturedState` discriminated union | `specs/featured.md` §2, `design.md` §3 | `src/featured/domain/featured-state.ts` exports the 5-variant union; an exhaustive `assertNever` helper exists for the renderer. | T2.1 | type-check only. | S |
| T2.4 | Injectable clock + time format helpers | `design.md` §11, §15 | `src/shared/time/now.ts` exports `getNow(): number` (defaults to `Date.now`) and a test-only setter; `src/shared/time/format.ts` exports `formatTime`, `formatDate`, `formatRelativeDay` using `Intl.DateTimeFormat(undefined, ...)`. | T0.3 | unit: setter overrides clock; format helpers produce expected output for a fixed instant in two stubbed locales. | S |

### Phase 3 — Data-source adapter

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T3.1 | `MatchSource` port + `chooseSource` walker + `loadMatches` composition root | `specs/data-source.md` §3, §4, `design.md` §4, §4.2 | `src/matches/ports/match-source.ts` defines the interface; `src/matches/adapters/choose-source.ts` walks an ordered list and returns the first valid payload (or `null` after all fail); `src/app/main.ts` composes `[primary, history, fixture]` per env. `noUncheckedIndexedAccess` is respected. | T2.1, T2.2 | unit: 3 cases per `design.md` §15 (remote ok skips others, remote fail → history, both fail → fixture). | M |
| T3.2 | `ManualSource` adapter | `specs/data-source.md` §3.1, `design.md` §4 | `src/matches/adapters/manual-source.ts` returns the bundled fixture via `Promise.resolve`; performs zero network I/O. | T3.1, T4.1 | unit: AC-2 of `specs/data-source.md` (no network in manual mode). | S |
| T3.3 | `RemoteSource` adapter | `specs/data-source.md` §3.2, `design.md` §4 | `src/matches/adapters/remote-source.ts` fetches `/data/matches.json` with `cache: "no-store"`; throws on non-2xx; Zod-validates the response. | T3.1 | unit (mocked fetch): success returns parsed payload; 404 throws; malformed JSON throws; schema mismatch throws. | M |
| T3.4 | `HistorySource` adapter | `specs/data-source.md` §4, `design.md` §4.1 | `src/matches/adapters/history-source.ts` fetches `/data/history/index.json` (manifest schema enforced), reads `entries[0]`, fetches that snapshot, Zod-validates; throws on any failure. | T3.1 | unit (mocked fetch): empty manifest throws; non-existent snapshot throws; valid manifest + valid snapshot returns parsed payload. | M |
| T3.5 | Vite env typings | `design.md` §4, `conventions.md` §1 | `src/app/env.d.ts` declares `VITE_DATA_SOURCE: "manual" \| "remote"` on `ImportMetaEnv`; default in `.env` is `remote`; `.env.development` documents toggling to `manual`. | T0.1 | type-check fails if env access is mistyped. | S |

### Phase 4 — Bundled fixture

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T4.1 | Hand-curated fixture dataset | `specs/data-source.md` §3.1, §4, `design.md` §4 | `src/shared/fixture/matches.fixture.json` contains ~48 matches covering: a full group-stage day (multiple kickoffs in one day), a single-live scenario, a multi-live scenario (two simultaneous kickoffs), an empty-day, a known future date for `upcoming-future`, and one knockout (e.g. `round-of-16`). All `utcKickoff` values are ISO with `Z`. Imported via `import.meta.glob` or static `import` from `manual-source.ts`. | T2.2 | unit: parsing the fixture through `matchListSchema` succeeds (golden test). | M |

### Phase 5 — Featured state machine

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T5.1 | `selectFeaturedState` pure selector | `specs/featured.md` §2-§5, `design.md` §6 | `src/featured/domain/select-featured-state.ts` exports `LIVE_WINDOW_MS = 110 * 60_000`, `selectFeaturedState(matches, now)`, `computeTournamentEnd`, `isLive`, `isUpcoming`, `byKickoff`. Pure, no I/O, no Vue. | T2.1, T2.3, T2.4 | unit: one test per AC in `specs/featured.md` §9 (AC-1 through AC-11 except UI-only AC-12 through AC-15). Includes single-live, multi-live tiebreaker, upcoming-today tiebreaker by id, upcoming-future, tournament-over derivation. | L |
| T5.2 | `todayBounds` + `isToday` helpers | `specs/matches.md` §2, §3, `design.md` §11 | `src/matches/domain/today.ts` exports `todayBounds(now)` and `isToday(utc, now)`; uses host-local arithmetic (`new Date(y,m,d)`); DST-safe (the +24h step is documented). | T2.4 | unit: AC-1, AC-2, AC-5 from `specs/matches.md` §8; half-hour offset case; DST spring-forward case. | M |
| T5.3 | List ordering + state-resolution helper | `specs/matches.md` §4, §5 | `src/matches/domain/sort.ts` exports `byKickoffThenId`; `src/matches/domain/resolve-state.ts` derives `MatchStatus` from `utcKickoff` + explicit source state per spec §5 (data-source state wins). | T2.1, T2.4 | unit: AC-3, AC-9, AC-10 from `specs/matches.md` §8. | S |

### Phase 6 — Countdown engine

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T6.1 | `useCountdown(targetMs)` composable | `specs/featured.md` §6, `design.md` §7 | `src/featured/composables/useCountdown.ts` exposes `remaining: Ref<number>` that recomputes from `Date.now()` every tick; clamps at zero; cleans up on unmount; restarts on `targetMs` change. | T2.4 | unit (with mocked clock + `vi.useFakeTimers`): decrements per second; no negative values; resync after large clock jump; cleanup on unmount. | M |

### Phase 7 — Visual identity assets

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T7.1 | Copy circle-flag SVGs for the 48-country shortlist | `design.md` §14.1, §14.2 | `src/shared/flags/*.svg` contains lowercase ISO-alpha-2 named files for every team that can appear in the WC 2026 fixture; license attribution recorded in repo (e.g. `src/shared/flags/LICENSE`). | T0.3 | n/a — visual. | S |
| T7.2 | `resolveFlag(iso)` resolver | `design.md` §14.2 | `src/shared/flags/resolve.ts` uses `import.meta.glob` to map ISO to URL; returns `null` for unknown codes. | T7.1 | unit: known code returns truthy URL; unknown returns `null`. | S |
| T7.3 | Team-colors lookup + `resolveGlow` | `design.md` §14.6 | `src/shared/flags/team-colors.ts` exports `TEAM_COLORS` map (seed with ~10 confirmed entries from `design.md` §14.6; remaining ~38 marked with `// TODO: confirm primary` comments), `FALLBACK_GLOW`, `resolveGlow(iso)`. Picked-one-primary policy documented in module header. | T0.3 | unit: known code returns its glow; unknown returns `FALLBACK_GLOW`; case-insensitive. | S |

### Phase 8 — Components

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T8.1 | `MatchCard` component | `specs/featured.md` §7.4, `specs/matches.md` §4 | `src/matches/ui/MatchCard.vue` with CSS Modules; renders both team mini-medallions (24px), names, local kickoff time, stage label, state badge; uses theme tokens. | T1.1, T2.1, T2.4, T7.2 | component: renders all match states (scheduled/live/finished/postponed); a11y label includes both team names + kickoff. | M |
| T8.2 | `MatchesList` component | `specs/matches.md` §4, §6 | `src/matches/ui/MatchesList.vue` renders today's matches sorted via `byKickoffThenId`; empty state communicates "no hay partidos hoy"; cancelled matches excluded; passes through to `MatchCard`. | T8.1, T5.3 | component: AC-6, AC-7, AC-8 of `specs/matches.md`. | M |
| T8.3 | `Countdown` component | `specs/featured.md` §6 | `src/featured/ui/Countdown.vue` renders `HH:MM:SS` (with leading days when applicable); uses `useCountdown`; clamps at zero. | T6.1 | component: AC-8, AC-9, AC-10 of `specs/featured.md`. | M |
| T8.4 | `FeaturedCard` component (all 5 state variants) | `specs/featured.md` §4, §7, `design.md` §14 | `src/featured/ui/FeaturedCard.vue` renders each `FeaturedState.kind` per the design: derby tableau (medallions + VS stamp + country names) for two-team states with team-color halo via `--team-a-glow` / `--team-b-glow`; "Hay N partidos en vivo" for multi-live without team identity; terminal message for tournament-over. CSS Modules. Exhaustive `assertNever`. | T1.1, T2.3, T5.1, T6.1, T7.2, T7.3, T8.3 | component: one test per state variant; halo custom-properties applied; dark-mode mount snapshot; AC-12, AC-13, AC-14 of `specs/featured.md`. | L |
| T8.5 | `FeaturedSection` container | `specs/featured.md` §5 | `src/featured/ui/FeaturedSection.vue` wires `useFeatured` (composable in T8.6) to `FeaturedCard`; re-evaluates on data-refresh + visibility-change. | T8.4, T8.6 | component: state transitions when underlying match list is replaced (AC-11). | S |
| T8.6 | `useFeatured` composable | `specs/featured.md` §5, `design.md` §3 | `src/featured/composables/useFeatured.ts` exposes a `ComputedRef<FeaturedState>` bound to a `Ref<readonly Match[]>` and a tick source (`useCountdown` 1s pulse). | T5.1, T6.1 | unit: same inputs produce same state; tick advances trigger re-evaluation. | M |
| T8.7 | `useMatches` composable | `specs/matches.md` §3, §4, `specs/data-source.md` §5 | `src/matches/composables/useMatches.ts` exposes reactive `matches`, `status: "idle" \| "loading" \| "ready" \| "degraded" \| "error"`, `refresh()` method, `generatedAt` for staleness UI. Atomic replacement (AC-7). | T3.1 | unit: refresh success replaces atomically; refresh failure preserves prior state (AC-8). | M |
| T8.8 | `NotificationCTA` component | `specs/notifications.md` §3, `design.md` §12.3 | `src/notifications/ui/EnableNotificationsButton.vue` shows "Avisame 15 min antes"; on click requests permission; collapses to "avisos activos" on grant; shows passive re-enable hint on deny. | T1.1 | component: AC-1, AC-2, AC-3 of `specs/notifications.md`. | M |

### Phase 9 — Notification scheduling

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T9.1 | `planSchedule` pure function + lead-time constant | `specs/notifications.md` §4, §5, §6.5, `design.md` §8 | `src/notifications/domain/lead-time.ts` exports `NOTIFICATION_LEAD_MS = 15 * 60_000`; `src/notifications/domain/schedule.ts` exports `planSchedule(matches, now): ScheduleEntry[]` filtering by `status === "scheduled"` and `fireAt > now`; content matches §5 contract. | T2.1 | unit: AC-4, AC-5, AC-6 of `specs/notifications.md`; idempotent on same inputs; dedup-friendly (entries carry `matchId`). | M |
| T9.2 | `Notifier` port + three adapters | `specs/notifications.md` §3, §6, `design.md` §8 | `src/notifications/ports/notifier.ts`; `show-trigger-notifier.ts`, `timeout-notifier.ts`, `sw-notifier.ts`; `pickNotifier()` runtime selection; all use `tag: matchId` for dedup/cancel. | T0.6, T9.1 | unit: `pickNotifier` returns ShowTrigger when available, Timeout otherwise (stub `Notification` global). | M |
| T9.3 | Custom SW logic for scheduled messages | `specs/notifications.md` §6.1, §6.3, `design.md` §8 | `src/sw/notifications-sw.ts` listens for `postMessage` schedule payloads; maintains an in-memory queue; sets a single `setTimeout` for the earliest fire-time; re-evaluates on wake events; integrated via `vite-plugin-pwa` `injectManifest` strategy if needed. | T0.6, T9.1 | unit: queue ordering; cancellation by `tag`; AC-10 (offline delivery) traced via mock. | L |
| T9.4 | `useNotifications` composable | `specs/notifications.md` §3, §4, §6 | `src/notifications/composables/useNotifications.ts` exposes `permission`, `requestPermission()` (must be in user-gesture handler), `resync()` that re-plans on boot/visibility/list-replace; cancels prior schedule by `tag`. | T9.1, T9.2, T9.3 | unit: AC-7 (dedup across rounds), AC-8 (postponed cancellation), AC-9 (rescheduling), AC-12 (revoked-externally rescan). | M |

### Phase 10 — App shell

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T10.1 | `App.vue` root SFC | `design.md` §2 | `src/app/App.vue` lays out header (with `ThemeToggle`), `FeaturedSection`, `MatchesList`, `NotificationCTA`, install affordance slot, stale-data indicator slot; uses tokens; single-route app. | T1.5, T8.2, T8.5, T8.8 | component: renders all sections; layout adapts at mobile breakpoint. | M |
| T10.2 | `main.ts` composition root | `design.md` §4.2, §9 | `src/app/main.ts` instantiates the fallback chain, wires `useMatches` initial load, mounts `App.vue` to `#app`, registers SW via `registerSW.ts`, attaches `visibilitychange` handler that calls `useMatches().refresh()` and `useNotifications().resync()`. | T3.1, T3.2, T3.3, T3.4, T8.7, T9.4, T10.1 | E2E (T12.2) covers boot path; unit: visibility-change handler is invoked once on regain. | M |
| T10.3 | Install affordance + stale-data indicator | `specs/pwa.md` §3, §5, AC-2 | `src/app/InstallPrompt.vue` captures `beforeinstallprompt`, exposes a button that triggers `prompt()`; hidden in standalone mode; passive "los datos pueden estar desactualizados" hint shown when `useMatches().status === "degraded"`. | T0.6, T8.7 | component: AC-4 (affordance shown when installable), AC-5 (hidden in standalone), AC-6 (no auto-prompt). | M |

### Phase 11 — GitHub Actions pipeline

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T11.1 | Tournament constants + `getRefreshMode` + `shouldFetch` | `design.md` §10.1 | `scripts/refresh/tournament.ts` exports `TOURNAMENT_START_UTC`, `TOURNAMENT_END_UTC`, `NEAR_LEAD_DAYS`, `NEAR_TAIL_DAYS`, `RefreshMode`; `scripts/refresh/window.ts` exports the two pure functions. | T0.1 | unit: 7 `getRefreshMode` boundary cases per `design.md` §15; `shouldFetch` table-driven cases. | M |
| T11.2 | Fetch + transform from football-data.org | `design.md` §10.3, `specs/data-source.md` §8 | `scripts/refresh/fetch.ts` reads `FOOTBALL_DATA_TOKEN` from env (NEVER `VITE_`-prefixed), calls the competition endpoint, transforms to project `Match[]` shape; pure transform module separated for tests. | T11.1, T2.2 | unit (with fixture upstream payload): transform produces a Zod-valid `Match[]`; missing token throws. | M |
| T11.3 | Canonical-hash short-circuit + history rotation | `design.md` §10.2, `specs/data-source.md` §7 | `scripts/refresh/rotate.ts` implements the 6-step rotation: hash compare, move-to-history with previous-commit UTC date as filename, write new `matches.json` sorted by `utcKickoff`, prune to N=7, write `history/index.json` manifest. | T11.1 | unit (with temp dir): identical payload → no-op; new payload → rotation + manifest update; >7 entries → oldest pruned; same-day double-refresh overwrites. | L |
| T11.4 | `scripts/refresh-matches.ts` orchestrator | `design.md` §10.3 | Top-level script chains `getRefreshMode → shouldFetch → fetch → transform → validate → hash → rotate`; exits non-zero on any failure; logs structured progress. | T11.1, T11.2, T11.3 | unit: orchestrator early-exit paths (off mode, already-recent, schema fail). | M |
| T11.5 | `.github/workflows/refresh-matches.yml` | `design.md` §10.3 | Daily cron `0 4 * * *`, `workflow_dispatch` enabled; checks out with `fetch-depth: 0`; runs `npm run refresh:matches`; commits via bot identity only if `public/data/` diff is non-empty; uses `${{ secrets.FOOTBALL_DATA_TOKEN }}`. | T11.4 | manual: `workflow_dispatch` from main produces an expected commit; AC-12 (token NOT in any committed artifact) verified by `git grep` in CI. | S |
| T11.6 | Seed initial `public/data/matches.json` + empty `history/index.json` | `specs/data-source.md` §2, §7 | Initial commit of `public/data/matches.json` (can be the bundled fixture content) so first deploy has something to serve; `public/data/history/index.json` initialized as `{ "version": 1, "entries": [] }`. | T4.1 | n/a — seeded data. | S |

### Phase 12 — Polish, a11y, deploy

| ID | Title | Ref | Acceptance | Deps | Tests | Est |
|---|---|---|---|---|---|---|
| T12.1 | Stage-label Spanish translation map | `design.md` §16 | `src/matches/ui/stage-label.ts` maps `Stage` to Spanish copy (`group → "Fase de grupos"`, etc.); used by `MatchCard` and `FeaturedCard`. | T2.1 | unit: every union member mapped. | S |
| T12.2 | Playwright smoke E2E | `specs/pwa.md` §4, §5, `design.md` §15 | One spec: cold load over preview server → assert today's list visible → assert install affordance discoverable → set `context.setOffline(true)` → reload → assert warm-load offline works (last-known data + stale indicator); permission CTA flow stubbed. | T10.2, T10.3, T11.6 | IS the test. | M |
| T12.3 | WCAG AA contrast audit in both themes | `specs/theming.md` §6 | Manual axe DevTools pass on every surface in both themes; live indicator MUST meet stricter bar (not red-on-black blur); fix any token violations; document any accepted residuals in `design.md` §16 if non-zero. | T1.1, T1.6, T8.1, T8.4 | n/a — manual + recorded results. | M |
| T12.4 | PWA manifest icons (light + dark working with neutral mid-tone) | `design.md` §9, §9.1 | Generate `192x192`, `512x512`, and maskable variants; reads tastefully against `#16161D` background; manifest references resolved paths; favicon updated. | T0.6 | manual: install on Android + iOS, verify splash + home-icon rendering. | M |
| T12.5 | GitHub Pages deploy workflow + `base` config | `conventions.md` §1, `design.md` §9 | `.github/workflows/deploy.yml` builds on push to `main`, deploys to `gh-pages`; Vite `base` set to repo path; SPA fallback for unknown routes (via 404 redirect or `navigateFallback`); release notes that pipeline writes are caught by deploy. | T0.1, T11.5 | manual: first successful deploy produces a reachable GH Pages URL; lighthouse PWA score ≥ 90. | M |
| T12.6 | Bundle audit: no upstream token, no unused flag SVGs | `specs/data-source.md` §8 AC-12, `design.md` §16 | `npm run build` artifacts scanned by a CI step (`grep -r` for token literal) → fails build if matched; bundle-size report logged. | T11.5, T12.5 | CI step IS the test. | S |

## 4. Definition of Done — MVP shippable

Derived from `proposal.md` §8 success criteria. The MVP is shippable when ALL of the following gates are green:

1. **Cold-load correctness.** On a fresh device with network, the user sees the correct `FeaturedState` and today's list within the first paint after data fetch. (T8.4, T8.5, T8.7, T10.2)
2. **Warm-load offline.** On a repeat load without network, the app renders the last-known matches and the correct computed live/upcoming state. Passive stale-data indicator visible. (T10.2, T10.3, T12.2)
3. **Installable PWA.** The browser's install affordance is available; in-app affordance is hidden in standalone mode. (T10.3, T12.4, T12.5)
4. **15-min notification.** With permission granted, a notification fires ~15 min before each scheduled match while the app or SW is alive. (T9.1, T9.2, T9.3, T9.4)
5. **All 5 featured states reachable.** Each variant of `FeaturedState` is verifiable via fixture combinations. (T4.1, T5.1, T8.4)
6. **Timezone correctness.** Same UTC kickoff renders correctly in ≥3 distinct local timezones without code changes. (T2.4, T5.2, T12.2 manual verification)
7. **No upstream token in bundle.** A built artifact passes `git grep` for the literal token. CI step fails the build if it appears. (T11.5, T12.6)
8. **Pipeline updates `matches.json`.** A successful `workflow_dispatch` produces a commit that the deploy workflow propagates. (T11.4, T11.5, T12.5)
9. **Themes: no FOUC.** Cold load with persisted dark override paints dark on the first frame, verified by E2E or video. (T1.2, T12.2)
10. **WCAG AA contrast.** Both themes pass automated + manual contrast audit on body text, secondary text, interactive elements, and the LIVE indicator. (T12.3)

## 5. Risks (flagged for the user)

- **No `sdd-tasks/SKILL.md` exists** — this task list follows the structure requested by the orchestrator's prompt and the openspec conventions. If a canonical skill is added later, re-validate this file against it.
- **Spec/design alignment on the `Match.status` union.** `specs/matches.md` §5 enumerates `scheduled | live | finished | postponed | cancelled`. `design.md` §3 matches. No drift detected.
- **Spec/design alignment on the live window.** `specs/featured.md` §3 and `design.md` §6 both use 110 min. No drift detected.
- **`useCountdown` deps `useFeatured` deps `useCountdown` pulse.** The "tick source" mentioned in T8.6 is intentional: `useFeatured` re-evaluates state on each 1s pulse, but it does NOT call `useCountdown` per-match — only a single shared 1s clock pulse. Clarify in the implementing PR to avoid a per-match RAF storm.
- **`design.md` §7 names the timer handle `raf` but uses `setTimeout`.** Minor naming inconsistency in `useCountdown` (the variable is called `raf` but holds a timeout id). Flagged here, not silently renamed. Implementer should rename to `tickHandle` or similar.
- **`history-source.ts` "newest-first" assumption.** `design.md` §4.1 says manifest `entries` are sorted newest-first by filename (ISO date prefix). T11.3 must produce manifests that respect this; otherwise the runtime adapter picks an older snapshot. Add an assertion in T11.3 tests.
- **`vite-plugin-pwa` strategy choice.** The design assumes `generateSW` (default) plus `runtimeCaching`. The custom SW logic (T9.3) needs `injectManifest` mode if it grows beyond what `runtimeCaching` covers. Open question — flag in the T9.3 PR description and pick the lighter strategy that satisfies the notification needs.
- **Initial `matches.json` seed (T11.6) duplicates the bundled fixture.** This is fine but means the first build ships ~2x the fixture bytes (one in JS, one in `public/`). Acceptable for MVP; mention in `design.md` §16 as a follow-up if budget gets tight.
- **`design.md` §15 expects `useTheme()` listener teardown on unmount, but state is module-scoped.** Multiple components mounting/unmounting each add+remove listeners cleanly; the design accepts this. T1.4 implementer should NOT try to "fix" this by moving state into a Vue plugin — that would break the module-singleton contract.
