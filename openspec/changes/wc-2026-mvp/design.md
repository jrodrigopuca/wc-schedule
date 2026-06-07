# Design — wc-2026-mvp

## 0. Document scope

This is the technical design for `wc-2026-mvp`. It commits to concrete shapes, file layout, runtime behavior, and resolves every open question from `proposal.md` §9. A senior developer should be able to start coding from this without further questions.

Spec contracts (capability-level WHAT) are authored in parallel under `specs/`. This document is the HOW.

---

## 1. Architectural overview

Screaming Architecture with a hexagonal seam at the data boundary. Three concentric rings:

```
┌─────────────────────────────────────────────────────────────┐
│  view layer (Vue SFCs)                                      │
│  - FeaturedSection.vue, MatchList.vue, InstallPrompt.vue    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  composable layer (Vue, but framework-thin)           │  │
│  │  - useMatches, useFeatured, useCountdown,             │  │
│  │    useNotifications, useDataSource                    │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  domain layer (pure TypeScript, no Vue)         │  │  │
│  │  │  - Match types, selectFeaturedState,            │  │  │
│  │  │    isLive, todayBounds, schemas (Zod)           │  │  │
│  │  │                                                 │  │  │
│  │  │  port: MatchSource                              │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  adapters (driven side): ManualSource, RemoteSource         │
│  composition root: src/app/main.ts wires the chosen adapter │
└─────────────────────────────────────────────────────────────┘

Out-of-process pipeline (not part of runtime):
GitHub Actions cron → football-data.org → transform → Zod validate
                                                  → public/data/matches.json
```

Dependency rule: arrows point inward. Vue may import domain; domain may NOT import Vue. Adapters depend on the `MatchSource` port, not the other way around.

---

## 2. Module layout

```
src/
├── app/
│   ├── main.ts                       # composition root, wires MatchSource
│   ├── App.vue                       # root SFC, mounts the single route
│   ├── env.d.ts                      # import.meta.env typing
│   └── registerSW.ts                 # vite-plugin-pwa registration glue
│
├── matches/
│   ├── domain/
│   │   ├── match.ts                  # Match, MatchStatus, Stage, Team, Score types
│   │   ├── match.schema.ts           # Zod schema for Match[]
│   │   ├── today.ts                  # todayBounds(), isToday()
│   │   └── live.ts                   # isLive(match, now), LIVE_WINDOW_MS
│   ├── ports/
│   │   └── match-source.ts           # MatchSource interface
│   ├── adapters/
│   │   ├── manual-source.ts          # bundled fixture adapter
│   │   ├── remote-source.ts          # fetch public/data/matches.json
│   │   └── fixture.ts                # the bundled fallback dataset
│   ├── composables/
│   │   └── useMatches.ts             # exposes reactive Match[] + status
│   └── ui/
│       ├── MatchList.vue
│       └── MatchCard.vue
│
├── featured/
│   ├── domain/
│   │   ├── featured-state.ts         # FeaturedState discriminated union
│   │   └── select-featured-state.ts  # pure selector
│   ├── composables/
│   │   ├── useFeatured.ts            # binds selector to reactive matches + now
│   │   └── useCountdown.ts           # tick engine
│   └── ui/
│       ├── FeaturedSection.vue
│       ├── FeaturedCard.vue
│       └── Countdown.vue
│
├── notifications/
│   ├── domain/
│   │   ├── schedule.ts               # planSchedule(matches, now): Plan
│   │   └── lead-time.ts              # NOTIFICATION_LEAD_MS = 15 * 60_000
│   ├── ports/
│   │   └── notifier.ts               # Notifier interface
│   ├── adapters/
│   │   ├── show-trigger-notifier.ts  # uses Notification.showTrigger
│   │   ├── timeout-notifier.ts       # setTimeout fallback (foreground)
│   │   └── sw-notifier.ts            # postMessage to SW for background
│   ├── composables/
│   │   └── useNotifications.ts       # permission + scheduling lifecycle
│   └── ui/
│       └── EnableNotificationsButton.vue
│
├── shared/
│   ├── time/
│   │   ├── format.ts                 # Intl.DateTimeFormat wrappers
│   │   └── now.ts                    # injectable clock (testability)
│   ├── types/
│   │   └── result.ts                 # Result<T, E> helper
│   └── ui/
│       └── tokens.module.css         # design tokens (colors, spacing)
│
└── sw/
    └── notifications-sw.ts           # custom SW logic merged via vite-plugin-pwa
```

`tests/` mirrors `src/` for unit + component tests. `e2e/` holds the Playwright smoke.

---

## 3. Type model

All types live in `src/matches/domain/match.ts` and `src/featured/domain/featured-state.ts`. Strict mode + `exactOptionalPropertyTypes` means optional fields use `?:` and may be absent entirely (not `undefined`).

```ts
// src/matches/domain/match.ts

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type Stage =
  | "group"
  | "round-of-32"
  | "round-of-16"
  | "quarter-final"
  | "semi-final"
  | "third-place"
  | "final";

export interface Team {
  readonly id: string;          // ISO-like short code, e.g. "ARG"
  readonly name: string;        // display name in Spanish
  readonly crestUrl?: string;   // omitted entirely if unknown
}

export interface Score {
  readonly home: number;
  readonly away: number;
}

export interface Match {
  readonly id: string;                   // stable upstream id
  readonly utcKickoff: string;           // ISO 8601, always Z
  readonly status: MatchStatus;
  readonly stage: Stage;
  readonly group?: string;               // "A".."L" only for group stage
  readonly home: Team;
  readonly away: Team;
  readonly score?: Score;                // data may carry one; UI renders ONLY when status === "finished" (see §14.8)
  readonly venue?: { city: string; country: string };
}
```

```ts
// src/featured/domain/featured-state.ts
import type { Match } from "@/matches/domain/match";

export type FeaturedState =
  | { kind: "single-live"; match: Match }
  | { kind: "multi-live"; count: number; matches: readonly Match[] }
  | { kind: "next-today"; match: Match; msUntilKickoff: number }
  | { kind: "next-future"; match: Match; msUntilKickoff: number }
  | { kind: "tournament-over" };
```

Discriminated union on `kind` — exhaustive switching enforced via a `never` check in the renderer.

Runtime values never use `any`. Where the boundary is untyped (JSON, postMessage), we land in `unknown` and narrow via Zod or a typed parser.

---

## 4. Data-source adapter

The domain depends on a port; the composition root picks an adapter. The port:

```ts
// src/matches/ports/match-source.ts
import type { Match } from "@/matches/domain/match";

export interface MatchSource {
  /**
   * Loads the full match list. Implementations MUST throw on transport
   * failure and MUST NOT return partially-validated data.
   */
  load(): Promise<readonly Match[]>;
}
```

Three implementations: `RemoteSource` (current `matches.json`), `HistorySource` (most recent file in `public/data/history/`), and `ManualSource` (the bundled fixture).

```ts
// src/matches/adapters/remote-source.ts
import { matchListSchema } from "@/matches/domain/match.schema";
import type { MatchSource } from "@/matches/ports/match-source";

export const createRemoteSource = (url = "/data/matches.json"): MatchSource => ({
  async load() {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`remote-source: ${res.status}`);
    const raw: unknown = await res.json();
    return matchListSchema.parse(raw); // throws on schema drift
  },
});
```

```ts
// src/matches/adapters/manual-source.ts
import { fixture } from "./fixture";
import type { MatchSource } from "@/matches/ports/match-source";

export const createManualSource = (): MatchSource => ({
  load: () => Promise.resolve(fixture),
});
```

### 4.1 HistorySource

`HistorySource` is the new middle tier of the fallback chain. It exists because the GH Action retains the last 7 successful snapshots (§10.2), and "yesterday's matches" is strictly better than "the bundled fixture from last quarter" when the live `matches.json` cannot be parsed.

**Discovery mechanism — DECISION: a manifest file.** The runtime reads `public/data/history/index.json`, a tiny array of filenames written by the GH Action in the same atomic commit that rotates a snapshot. Rejected: (a) listing the `/data/history/` directory at runtime — GitHub Pages does not serve directory indexes for SPAs and even when it does the format is HTML, not stable; (b) baking the manifest into the SW precache — the SW would need to be regenerated and replayed on each refresh, blowing the cache for unrelated assets. The manifest approach is one extra ~200-byte file and zero infrastructure assumptions.

Manifest shape (sorted newest-first by filename, which is lex-sortable thanks to the ISO date prefix):

```ts
// public/data/history/index.json (on disk, written by the GH Action)
export interface HistoryManifest {
  readonly version: 1;
  readonly entries: readonly string[]; // ["matches-2026-06-18.json", ...]
}
```

The runtime adapter:

```ts
// src/matches/adapters/history-source.ts
import { z } from "zod";
import { matchListSchema } from "@/matches/domain/match.schema";
import type { MatchSource } from "@/matches/ports/match-source";

const manifestSchema = z.object({
  version: z.literal(1),
  entries: z.array(z.string().regex(/^matches-\d{4}-\d{2}-\d{2}\.json$/)),
});

export const createHistorySource = (
  baseUrl = "/data/history",
): MatchSource => ({
  async load() {
    const manifestRes = await fetch(`${baseUrl}/index.json`, { cache: "no-store" });
    if (!manifestRes.ok) throw new Error(`history-manifest: ${manifestRes.status}`);
    const manifest = manifestSchema.parse(await manifestRes.json());
    const newest = manifest.entries[0];
    if (newest === undefined) throw new Error("history-source: empty manifest");

    const snapshotRes = await fetch(`${baseUrl}/${newest}`, { cache: "no-store" });
    if (!snapshotRes.ok) throw new Error(`history-snapshot: ${snapshotRes.status}`);
    const raw: unknown = await snapshotRes.json();
    return matchListSchema.parse(raw); // same schema as RemoteSource
  },
});
```

`noUncheckedIndexedAccess` forces the `entries[0]` check; the `undefined` branch handles a brand-new repo whose manifest is empty.

### 4.2 Fallback chain composition

The composition root tries sources **in order**, each MUST validate via `matchListSchema` before being accepted, and the chain **cancels further attempts as soon as one source yields a valid payload**. No source is consulted speculatively.

```ts
// src/matches/adapters/choose-source.ts
import type { MatchSource } from "@/matches/ports/match-source";

export async function chooseSource(
  sources: readonly MatchSource[],
  onSkip: (index: number, err: unknown) => void,
): Promise<readonly Match[] | null> {
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    try {
      return await src.load(); // valid (Zod-parsed) → DONE, no further attempts
    } catch (err) {
      onSkip(i, err);
      continue;
    }
  }
  return null;
}
```

```ts
// src/app/main.ts (excerpt)
const primary  = import.meta.env.VITE_DATA_SOURCE === "manual"
  ? createManualSource()
  : createRemoteSource();
const history  = createHistorySource();
const fixture  = createManualSource();

const matchSource: MatchSource = {
  async load() {
    const result = await chooseSource(
      [primary, history, fixture],
      (i, err) => console.warn(`source[${i}] skipped`, err),
    );
    if (result === null) {
      showErrorToast("No pudimos cargar los partidos. Probá de nuevo más tarde.");
      return [];
    }
    return result;
  },
};
```

Runtime fallback chain: **current `matches.json` → most recent file in `/data/history/` (via manifest) → bundled fixture → empty-state with toast**. Each step is independently Zod-validated; an invalid payload at any tier is treated as "this tier failed" and the chain advances.

`import.meta.env.VITE_DATA_SOURCE` is `"manual" | "remote"`, defaulting to `"remote"` in production builds. Typed in `src/app/env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE: "manual" | "remote";
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

---

## 5. Defensive validation

**Decision: Zod 4** as the runtime validator at the source boundary. Reasons: schema-as-type single source of truth, narrowed errors, already in the team's skill catalog. Rejected: `valibot` (smaller but team unfamiliar), hand-rolled type guards (verbose, error-prone), JSON Schema + ajv (heavier toolchain).

Validation happens in two places:
1. **Pipeline** (GitHub Actions): validates AFTER transform, BEFORE commit. Failure → job fails, no commit.
2. **Client** (`RemoteSource.load`): validates AFTER `fetch`. Failure → falls through to fixture, logs structured error.

```ts
// src/matches/domain/match.schema.ts
import { z } from "zod";

const teamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  crestUrl: z.string().url().optional(),
});

const scoreSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
});

const matchSchema = z.object({
  id: z.string().min(1),
  utcKickoff: z.iso.datetime({ offset: false }), // requires trailing Z
  status: z.enum(["scheduled", "live", "finished", "postponed", "cancelled"]),
  stage: z.enum([
    "group", "round-of-32", "round-of-16",
    "quarter-final", "semi-final", "third-place", "final",
  ]),
  group: z.string().regex(/^[A-L]$/).optional(),
  home: teamSchema,
  away: teamSchema,
  score: scoreSchema.optional(),
  venue: z.object({ city: z.string(), country: z.string() }).optional(),
});

export const matchListSchema = z.array(matchSchema).readonly();
export type ValidatedMatch = z.infer<typeof matchSchema>;
```

The inferred type and the hand-written `Match` interface must stay in sync. A compile-time assertion lives next to the schema:

```ts
const _typeCheck: ValidatedMatch extends Match ? true : false = true;
```

---

## 6. Featured state machine

Pure function, no I/O, no Vue. Lives in `src/featured/domain/select-featured-state.ts`:

```ts
export const LIVE_WINDOW_MS = 110 * 60_000; // 110 minutes

export function selectFeaturedState(
  matches: readonly Match[],
  now: number,
): FeaturedState {
  const tournamentEnd = computeTournamentEnd(matches);
  if (tournamentEnd !== null && now > tournamentEnd) {
    return { kind: "tournament-over" };
  }

  const live = matches.filter((m) => isLive(m, now));
  if (live.length === 1) return { kind: "single-live", match: live[0]! };
  if (live.length > 1) {
    return { kind: "multi-live", count: live.length, matches: live };
  }

  const today = todayBounds(now);
  const upcomingToday = matches
    .filter((m) => isUpcoming(m, now) && inRange(m.utcKickoff, today))
    .sort(byKickoff);

  if (upcomingToday.length > 0) {
    const next = upcomingToday[0]!;
    return {
      kind: "next-today",
      match: next,
      msUntilKickoff: Date.parse(next.utcKickoff) - now,
    };
  }

  const upcomingFuture = matches.filter((m) => isUpcoming(m, now)).sort(byKickoff);
  if (upcomingFuture.length > 0) {
    const next = upcomingFuture[0]!;
    return {
      kind: "next-future",
      match: next,
      msUntilKickoff: Date.parse(next.utcKickoff) - now,
    };
  }

  return { kind: "tournament-over" };
}
```

Rules and tiebreakers:

- **Live window**: a match is live if `now ∈ [kickoff, kickoff + 110min)` AND `status !== "finished"` AND `status !== "cancelled"`. 110 minutes covers regulation + halftime + injury time + a buffer; extra time and penalties exceed it but trigger `status === "live"` upstream once the daily refresh updates.
- **Postponed**: excluded from live and upcoming lists entirely until status flips.
- **Tiebreaker upcoming today**: earliest `utcKickoff` wins. Stable secondary sort by `id` so the UI doesn't flicker between identical timestamps.
- **Tiebreaker live**: `multi-live` does not pick one — it summarizes. List of live matches passed through in `utcKickoff` order.
- **Tournament-over detection**: `computeTournamentEnd` finds the latest `utcKickoff` in the fixture, adds `LIVE_WINDOW_MS`, and treats that as the boundary. If the list is empty, returns `null` (the empty-state path returns `tournament-over` anyway). This avoids a hardcoded date that goes stale on a re-scheduled final.

---

## 7. Countdown engine

Composable in `src/featured/composables/useCountdown.ts`. Design goals: cheap, drift-corrected, cleans up on unmount.

```ts
export function useCountdown(targetMs: Ref<number>) {
  const remaining = ref(targetMs.value - Date.now());
  let raf = 0;
  let lastWall = performance.now();

  const tick = () => {
    const wall = performance.now();
    // drift correction: align to real wall clock, not accumulated deltas
    remaining.value = targetMs.value - Date.now();
    lastWall = wall;
    if (remaining.value > 0) {
      raf = window.setTimeout(tick, 1000);
    } else {
      remaining.value = 0;
      // emit transition; consumer flips to live state on its own
    }
  };

  onMounted(() => { tick(); });
  onUnmounted(() => { clearTimeout(raf); });

  // when target changes (postponement, new featured match), restart
  watch(targetMs, () => { clearTimeout(raf); tick(); });

  return { remaining };
}
```

Decisions:
- **Cadence**: `setTimeout(tick, 1000)` aligned to wall clock. Rejected `setInterval` (drifts under throttling) and `requestAnimationFrame` (overkill, doesn't fire when tab hidden).
- **Drift correction**: every tick recomputes from `Date.now()`, never accumulates deltas. Survives suspend/resume cleanly.
- **At zero**: `remaining` becomes `0`. The consumer (`useFeatured`) re-runs `selectFeaturedState` on the next tick and transitions naturally to `single-live`. The countdown does NOT force a state transition — the state machine owns that.
- **Cleanup**: `onUnmounted` clears the pending timeout. No leaks across route changes (there are none, but the hygiene is free).
- **Visibility re-sync**: on `visibilitychange` → visible, `useMatches` re-fetches and `useCountdown` re-runs `tick()` once to correct for throttled background time.

---

## 8. Notification scheduling

Single execution path in production, single planning function. Lead time is `NOTIFICATION_LEAD_MS = 15 * 60_000`, defined once in `src/notifications/domain/lead-time.ts`.

**Phase 9a/9b decision (LOCKED)**: only `showTrigger` is wired in production. `pickNotifier()` returns the showTrigger adapter when supported, otherwise `null` — and the composable interprets `null` as `'unsupported'`, hiding the CTA entirely. The foreground `setTimeout` notifier (`timeout-notifier.ts`) remains in the repo as **documentation + a test seam** for unit-testing `useNotifications.schedule()` against the port; production composition never picks it. See §12.2 for the full rationale.

**Strategy selection at runtime**:

```ts
function pickNotifier(): Notifier | null {
  if (!isShowTriggerSupported()) return null; // hide CTA entirely
  return createShowTriggerNotifier();          // OS-scheduled, tab-close-safe
}
```

Detection probes (all four must pass):
- `'Notification' in window`
- `'showTrigger' in Notification.prototype` (canonical surface)
- `'serviceWorker' in window.navigator`
- `typeof TimestampTrigger !== 'undefined'`

The retained-but-unused timeout strategy:

1. **`Notification.showTrigger` (production)**: schedule once at boot via `serviceWorkerRegistration.showNotification({ ...payload, showTrigger: new TimestampTrigger(fireAt) })`. OS-managed, survives tab close. Currently Chromium-only.
2. **`setTimeout` (NOT in production)**: foreground-only; kept as `timeout-notifier.ts` purely to (a) document the alternative, and (b) provide a clean Notifier implementation for unit-testing `useNotifications.schedule()`. Rejected as a fallback — see §12.2.

**Content resolution timing — locked**: with showTrigger, the title and body are rendered at **schedule time**, not fire time, because the OS holds the pre-rendered notification. A locale switch after scheduling does NOT translate pending notifications. To honor a locale change, the user must trigger a re-schedule (re-grant permission, a refresh that re-runs `schedule()` on boot, or any `matches` mutation that cascades into a re-plan). The retained `timeout-notifier` resolves at fire time and is therefore a useful sanity reference, but production accepts the schedule-time tradeoff in exchange for tab-close delivery.

**Planning function** (pure, testable):

```ts
// src/notifications/domain/schedule.ts
export interface ScheduleEntry {
  readonly matchId: string;
  readonly fireAt: number;   // epoch ms
  readonly title: string;
  readonly body: string;
}

export function planSchedule(
  matches: readonly Match[],
  now: number,
): readonly ScheduleEntry[] {
  return matches
    .filter((m) => m.status === "scheduled")
    .map((m) => ({
      matchId: m.id,
      fireAt: Date.parse(m.utcKickoff) - NOTIFICATION_LEAD_MS,
      title: `${m.home.name} vs ${m.away.name}`,
      body: "Empieza en 15 minutos",
    }))
    .filter((e) => e.fireAt > now);
}
```

**Handling concerns**:

- **Cancellation on postponement**: each scheduled notification is tagged with `tag: matchId`. On every plan recomputation (boot, visibility-change, after data refresh), the previous set is cancelled and replaced. `showTrigger` notifications are cancelled via `registration.getNotifications({ tag }).then(ns => ns.forEach(n => n.close()))` plus a fresh schedule.
- **Deduplication on reload**: the `tag: matchId` ensures a re-scheduled notification overwrites the old one rather than duplicating.
- **Clock drift**: `fireAt` is recomputed from authoritative `utcKickoff` on every plan. We do not persist `fireAt`; it derives from the match.
- **Idempotency**: `planSchedule` is pure. Calling it twice with the same inputs yields equal outputs. The notifier is responsible for "diff then apply", not the planner.

---

## 9. PWA & service worker

`vite-plugin-pwa` config (intent — exact file in `vite.config.ts`):

```ts
VitePWA({
  registerType: "autoUpdate",     // decision below
  injectRegister: "auto",
  workbox: {
    navigateFallback: "/index.html",
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: { cacheName: "html", networkTimeoutSeconds: 3 },
      },
      {
        urlPattern: /\/data\/matches\.json$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "matches-data",
          expiration: { maxAgeSeconds: 60 * 60 * 24 * 2 },
        },
      },
      {
        urlPattern: /\/data\/history\/index\.json$/,
        handler: "CacheFirst",
        options: {
          cacheName: "history-manifest",
          expiration: { maxAgeSeconds: 60 * 60 * 6 }, // short TTL: 6h
        },
      },
      {
        urlPattern: /\/data\/history\/matches-\d{4}-\d{2}-\d{2}\.json$/,
        handler: "CacheFirst",
        options: {
          cacheName: "history-snapshots",
          expiration: { maxEntries: 7 }, // mirror retention in §10.2
        },
      },
      {
        urlPattern: /\.(?:js|css|woff2|svg|png|webp)$/,
        handler: "CacheFirst",
        options: { cacheName: "static-assets" },
      },
    ],
  },
  manifest: {
    name: "Mundial 2026",
    short_name: "Mundial 2026",
    lang: "es",
    start_url: "/",
    display: "standalone",
    theme_color: "#16161D",      // neutral mid-tone, see decision below
    background_color: "#16161D",
    icons: [/* 192, 512, maskable */],
  },
});
```

Decisions:

- **`autoUpdate` vs `prompt`**: `autoUpdate`. The app has no in-flight user work to lose; silent updates align with the "open it, get the answer" UX. Rejected `prompt` (requires custom UI, adds friction for a single-route app).
- **HTML: `NetworkFirst` with 3s timeout** → fresh shell when online, cached shell when offline.
- **`matches.json`: `StaleWhileRevalidate`** → instant render of last-known data, background refresh. Critical for cache-invalidation UX: users see something immediately, fresh data appears on the next render cycle when SWR resolves.
- **`history/index.json`: `CacheFirst` with 6h TTL** → the manifest changes at most once per UTC day (and often less, since "no payload change" short-circuits). A short TTL keeps offline fallback fresh without thrashing the network. Rejected `StaleWhileRevalidate` (the manifest is only consulted when `matches.json` fails — there's no rendering benefit to a stale-then-fresh swap).
- **`history/matches-YYYY-MM-DD.json`: `CacheFirst` with `maxEntries: 7`** → snapshot files are immutable once written (the GH Action overwrites in the same-UTC-day edge case, and the SW handles content change via fetch revalidation). Mirroring the retention cap (7) prevents the cache from accumulating stale snapshots after a re-deploy.
- **Static assets: `CacheFirst`** → immutable, content-hashed by Vite.

### 9.1 PWA manifest theming

The manifest's `theme_color` and `background_color` drive the OS-level chrome (splash screen, status bar tint on iOS, address bar tint on Android) **at install time**. The manifest is a static JSON file; the spec does not mandate runtime mutability and most browsers cache it aggressively.

**DECISION: a single neutral mid-tone (`#16161D`) for both `theme_color` and `background_color`, used in both light and dark themes.** This matches the dark-theme `--bg-card` token from the mockup and reads as a tasteful neutral against the light theme without clashing. Rejected alternatives:

- **A theme-matched static manifest**: forces the user's install-time theme onto the OS chrome forever, which feels wrong when they later switch themes inside the app.
- **JS-driven manifest update via Blob URL** (`<link rel="manifest" href="blob:...">` swapped at runtime based on `prefers-color-scheme`): supported in Chromium but not in Safari, brittle (relies on the browser re-reading the manifest after install), and the install-time snapshot still wins for the splash screen. The asymmetry across platforms is not worth the complexity for MVP.
- **Multiple `<link rel="manifest" media="...">` declarations**: spec-allowed but inconsistently respected by browser engines.

The neutral mid-tone is a documented compromise (see §16 risks). Post-MVP we can revisit JS-driven mutation if real users complain about the splash color in light mode.

### 9.2 SW precache for theming

The MVP intentionally uses **no theme-specific assets**:

- All icons (favicon, PWA icons 192/512, maskable) are designed to read well against both `#F6F5F0` (light) and `#0A0A0F` (dark). They use the brand accent green plus a neutral mark, with sufficient contrast in either direction.
- All flag SVGs (§14) are theme-agnostic by nature (they're national flags).
- Theme tokens are CSS custom properties living in a single stylesheet bundle — no theme-specific CSS files to precache separately.

Result: the `globPatterns` precache manifest is unchanged from a single-theme build. Both themes work offline because they're literally the same bytes with different CSS variable values resolved at render time.

**Visibility-change re-validation hook** lives in `src/app/main.ts`:

```ts
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void useMatches().refresh();      // re-run RemoteSource.load
    void useNotifications().resync(); // re-plan
  }
});
```

When the SWR cache yields new data, `useMatches` detects the diff (by `JSON.stringify` equality on a small payload — acceptable here) and updates the reactive state. UI rerenders, featured state recomputes, schedule replans.

---

## 10. GitHub Actions pipeline

Workflow file: `.github/workflows/refresh-matches.yml`. Schedule: **`0 4 * * *` UTC** — a **single daily cron** (04:00 UTC, picked because it's after all conceivable match days end and before user traffic peaks in the Americas). The job can also be `workflow_dispatch`-triggered.

The cron is fired every day unconditionally, but the script is **tournament-aware**: at run time it computes which refresh window applies and either does a full fetch+commit, skips because it already ran inside the current 48h slot, or is a complete no-op. Rejected alternatives: multiple separate workflows (operational overhead, harder to reason about), a self-rescheduling GH Action (not supported), an external scheduler (extra infrastructure).

### 10.1 Refresh-window decision

Tournament anchors are constants in a single config module — `scripts/refresh/tournament.ts`:

```ts
// scripts/refresh/tournament.ts
// FIFA World Cup 2026 official window. Update HERE if FIFA reschedules.
export const TOURNAMENT_START_UTC = "2026-06-11"; // kickoff day, UTC date
export const TOURNAMENT_END_UTC   = "2026-07-19"; // final day, UTC date

export const NEAR_LEAD_DAYS  = 30; // 30 days before kickoff
export const NEAR_TAIL_DAYS  = 7;  // 7 days after final

export type RefreshMode = "tournament" | "near" | "off";
```

All date arithmetic is **UTC-date-only** (no time-of-day, no host zone) — we compare bare YYYY-MM-DD strings via epoch-aligned `Date.UTC(...)` values to avoid DST and timezone surprises on the runner.

```ts
// scripts/refresh/window.ts
import {
  TOURNAMENT_START_UTC,
  TOURNAMENT_END_UTC,
  NEAR_LEAD_DAYS,
  NEAR_TAIL_DAYS,
  type RefreshMode,
} from "./tournament";

const DAY_MS = 24 * 60 * 60 * 1000;

const utcMidnight = (isoDate: string): number => {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

export function getRefreshMode(now: number): RefreshMode {
  const today = utcMidnight(new Date(now).toISOString().slice(0, 10));
  const start = utcMidnight(TOURNAMENT_START_UTC);
  const end   = utcMidnight(TOURNAMENT_END_UTC);

  // Inclusive on both ends: kickoff day and final day refresh every 24h.
  if (today >= start && today <= end) return "tournament";

  const nearStart = start - NEAR_LEAD_DAYS * DAY_MS;
  const nearEnd   = end   + NEAR_TAIL_DAYS * DAY_MS;
  if (today >= nearStart && today <= nearEnd) return "near";

  return "off";
}

// Cadence rule, pure: given the previous-refresh UTC date and "today",
// should this run actually fetch?
export function shouldFetch(
  mode: RefreshMode,
  todayUtcMs: number,
  lastRefreshUtcMs: number | null,
): boolean {
  if (mode === "off") return false;
  if (lastRefreshUtcMs === null) return true;
  const diffDays = Math.round((todayUtcMs - lastRefreshUtcMs) / DAY_MS);
  if (mode === "tournament") return diffDays >= 1; // every 24h
  return diffDays >= 2;                             // "near" → every 48h
}
```

Pseudocode for the orchestration that runs inside `npm run refresh:matches`:

```
mode = getRefreshMode(Date.now())
if mode === "off":
    log("outside tournament windows, no-op")
    exit 0

lastRefreshUtcMs = readLastCommitUtcDate("public/data/matches.json")
if not shouldFetch(mode, todayUtcMs, lastRefreshUtcMs):
    log("already refreshed within window, no-op")
    exit 0

payload     = fetchFromFootballData()
transformed = transform(payload)
validated   = matchListSchema.parse(transformed)   // throws → exit non-zero
rotateAndWrite(validated)                          // see §10.2
```

The `last-refresh date` is derived from the **previous commit's UTC date** for `public/data/matches.json` (via `git log -1 --format=%cI -- public/data/matches.json`, then truncated to the date). No sidecar file. Rejected: storing a `lastRefreshAt` field inside the JSON (mutates the payload schema for an operational concern), a separate `meta.json` (extra moving part).

### 10.2 Backup retention

On a successful fetch+validate, the script performs an atomic local rotation **before** writing the new payload. Rules:

1. **No-change short-circuit.** Compute the canonical-stringified hash (sorted keys, no whitespace) of the new payload and compare to the current `public/data/matches.json`. If byte-equivalent under canonical form, abort the whole rotation: no history move, no commit, exit 0. This makes the cron idempotent across multiple runs in the same UTC day.
2. **Rotate the current file into history.** Move `public/data/matches.json` to `public/data/history/matches-YYYY-MM-DD.json`, where the date is the **previous commit's UTC date** for `matches.json` (not "today"). Rationale: the snapshot represents the data that was live; using "today" would group every dormant interval under whatever day the next refresh happens, breaking chronological reasoning.
3. **Write the new payload** to `public/data/matches.json`.
4. **Prune.** Sort the contents of `public/data/history/` lexicographically (filenames are ISO date prefixes, so lex sort === chronological sort), keep the most recent 7, delete the rest in the same commit.
5. **Refresh the manifest.** Write `public/data/history/index.json` (see §4 for the runtime contract). Same commit.
6. **Commit everything atomically** (`matches.json`, the new history file, the deletions, the manifest) under a single `chore(data): refresh matches.json` commit.

Edge case — **two refreshes in the same UTC day** with different payloads: the second run finds a history file already named `matches-YYYY-MM-DD.json`. Resolution: overwrite it. The previous-commit date for the *current* `matches.json` is "today" in that scenario, so the new history snapshot replaces a same-day predecessor that the first run produced. Chronology stays consistent (one snapshot per UTC day at most). Dedup is implicit because step 1 already short-circuited identical payloads.

Failure of validation aborts the job (exits non-zero) **before** any rotation or write. The workflow fails, no commit is produced, and the previous `matches.json` and history remain untouched. Failure modes covered:
- Fetch error → script catches, exits non-zero.
- Transform error → throws, exits non-zero.
- Zod schema failure → throws, exits non-zero.

Naming convention: `matches-YYYY-MM-DD.json` (UTC date of the snapshot, ISO 8601 calendar form). Lex sort === chronological sort, which is what the runtime manifest and pruning logic both depend on.

### 10.3 Workflow file

```yaml
name: Refresh matches.json
on:
  schedule:
    - cron: "0 4 * * *"
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 } # need history for last-commit-date lookup
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - name: Refresh (window-aware)
        env:
          FOOTBALL_DATA_TOKEN: ${{ secrets.FOOTBALL_DATA_TOKEN }}
        run: npm run refresh:matches
      - name: Commit if changed
        run: |
          if ! git diff --quiet -- public/data/; then
            git config user.name "wc-schedule-bot"
            git config user.email "bot@users.noreply.github.com"
            git add public/data/
            git commit -m "chore(data): refresh matches.json"
            git push
          fi
```

`npm run refresh:matches` runs a Node script (`scripts/refresh-matches.ts`) that:

1. Calls `getRefreshMode(Date.now())`; if `"off"`, logs and exits 0 (workflow succeeds, no diff, no commit).
2. Calls `shouldFetch(mode, today, lastCommitDate)`; if `false`, logs and exits 0.
3. Fetches from football-data.org with the secret token.
4. Transforms the upstream response into the project's `Match[]` shape.
5. **Validates with the same `matchListSchema` used by the client.** On failure: script exits non-zero, workflow fails, no commit.
6. Canonical-hash short-circuit (§10.2 rule 1).
7. Rotates the current file into `public/data/history/` (§10.2 rules 2–4).
8. Writes `public/data/matches.json` (pretty-printed, sorted by `utcKickoff` for diff stability).
9. Writes `public/data/history/index.json` (§4).

Failure behavior: if any step before the write fails, no file is written. The previous `matches.json` and history remain on disk. The deploy workflow runs separately on `push` to `main`; a failed refresh does not trigger a deploy.

Secret naming: `FOOTBALL_DATA_TOKEN`. Single secret. Never injected into Vite's `import.meta.env` (no `VITE_` prefix → not exposed to the client bundle).

---

## 11. Timezone strategy

Hard rules:

- **Storage**: every kickoff is a UTC ISO string with explicit `Z` (`"2026-06-11T20:00:00Z"`). Zod enforces this.
- **Rendering**: `new Intl.DateTimeFormat(undefined, { ... })` resolves the user's local zone automatically. Wrapped in `src/shared/time/format.ts`:

```ts
const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit", minute: "2-digit",
});
const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short", day: "2-digit", month: "short",
});
```

- **"Today" boundary** is the local day, computed as `[startOfLocalDay(now), startOfNextLocalDay(now))`:

```ts
export function todayBounds(now: number): { start: number; end: number } {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}
```

This uses the **host** timezone via `new Date(year, month, day)` (which is local). DST is handled correctly because the `+24h` arithmetic happens in epoch ms and the next call to `Intl.DateTimeFormat` reapplies the local offset for rendering.

- **DST transitions**: on the spring-forward day, the local day is 23h long; on fall-back, 25h. The `+24h` step is acceptable: matches near the seam render in the correct local day because we compare `utcKickoff` epoch to the local-day epoch bounds. Edge case where the comparison technically miscategorizes is a 1h window that crosses local midnight on DST day — non-issue in practice because no kickoff falls there for World Cup matches.
- **Half-hour and 45-minute offsets** (India, Nepal, Newfoundland): `Intl` handles them natively. Our code never assumes an integer-hour offset.
- **Misconfigured device clocks**: out of scope. We assume `Date.now()` is accurate within ~minutes. If a user's clock is hours off, countdowns and notifications are wrong; this is a known limitation, not a bug to fix.

---

## 12. Resolved open questions

Every open question from proposal §9, with a decision, reasoning, and rejected alternative.

### 12.1 Timezone edge cases

**Decision**: store UTC, render with `Intl.DateTimeFormat()` defaulting to host zone. "Today" derived per §11 using local-day arithmetic.

**Reasoning**: `Intl` covers DST and fractional offsets without extra code. Local-day math via the `Date(year, month, day)` constructor is the standard idiom and avoids a date library dependency.

**Rejected**: shipping `luxon`/`date-fns-tz` (adds ~30KB for one boundary calculation), passing the offset over the wire (the publisher's zone is meaningless to the client).

### 12.2 Notification reliability fallback

**Decision (LOCKED, Phase 9b)**: ship **only** the `Notification.showTrigger` strategy in production. When the platform lacks showTrigger, hide the entire CTA — no foreground `setTimeout` fallback, no SW-queue fallback. Honest UX over half-broken graceful degradation.

**Reasoning**: the feature exists to "remind you 15 minutes before kickoff while you're doing something else". A foreground-only fallback delivers exactly the wrong UX — the user closes the tab, gets no reminder, and (worst case) thinks the app is broken or unreliable. Better to show nothing on Safari/Firefox/etc. than to ship a notification feature that silently misses the cases it was built for.

**Rejected — the prior triple-strategy plan**:
1. `Notification.showTrigger` when available (Chromium) — kept.
2. `setTimeout` while the app is foregrounded — **rejected**: dies the moment the user navigates away, which is the very scenario notifications exist for. Foreground reminders for the in-page case are better served by the visible countdown.
3. Service Worker with a recomputed queue — **rejected**: high implementation cost, the SW only fires on wake events (push, sync, navigation) that we don't have, and unreliable enough that we'd still be lying to the user.

**Also rejected**: push subscriptions (out of scope — no server), worker-managed alarms polyfill (overkill).

**Browser matrix today (2026-06)**:
- Chromium-based (Chrome, Edge, Brave, Opera, Samsung): CTA visible, scheduling works, tab-closed delivery works.
- Safari (any), Firefox (any), iOS browsers: CTA hidden — `EnableNotificationsButton` renders nothing.

**Code seam preserved**: `src/notifications/adapters/timeout-notifier.ts` remains in the repo as documentation + a Notifier-port reference implementation that unit tests of `useNotifications.schedule()` can wire against without DOM ceremony. Production never picks it.

### 12.3 Permission prompt UX

**Decision**: **gated CTA on the featured section after first list render**. A small button labeled "Avisame 15 min antes" appears below the featured card. Clicking it requests permission. If granted, the button collapses into a "✓ avisos activos" indicator; if denied, the button explains how to enable in browser settings and does not re-prompt.

**Reasoning**: tying the prompt to a visible benefit ("we'll remind you of *this* match") yields higher grant rates than a settings sheet. Featured-section placement is contextual: the user is already looking at "the next match", so the offer is relevant.

**Rejected**: separate settings sheet (extra navigation, lower discoverability), auto-prompt on first visit (gets blanket-denied by users and by Chrome's heuristics), prompt-on-install (the install affordance is browser-driven and not interceptable).

### 12.4 Simultaneous live matches presentation

**Decision**: **static summary card**. The `multi-live` state renders a single card: "Hay N partidos en vivo — mirá la lista", with the list below acting as the detail surface.

**Reasoning**: cycling carousels in a sports context create flicker, disrupt the "answer the question in one glance" goal, and complicate accessibility (focus management, screen reader churn). The list below already surfaces every live match with its localized live badge — duplicating that information in a cycling featured card adds nothing. (Note: live scores are NOT shown in either surface; see §14.8 and `matches.md` §5.1 for the rationale.)

**Rejected**: cycling carousel (UX cost > value), splitting the featured slot into N mini-cards (breaks the visual hierarchy on small screens).

### 12.5 Tournament-over detection

**Decision**: **derived from the fixture** — `tournamentEnd = max(utcKickoff) + LIVE_WINDOW_MS`. If `now > tournamentEnd`, the state machine returns `tournament-over`.

**Reasoning**: the fixture is the source of truth and survives schedule changes (rescheduled final, third-place playoff edits). A hardcoded date goes stale and requires a deploy to fix.

**Rejected**: hardcoded `TOURNAMENT_END_DATE` constant (brittle), reading a `tournamentEnd` field from the JSON (requires a pipeline change for a value we can compute).

### 12.6 Schema drift handling

**Decision**: **fail-closed at the pipeline, fail-soft at the client**. The GitHub Action validates with Zod after transform; on failure the job aborts and no commit happens — the old `matches.json` stays live. The client also validates on fetch; on failure it falls through to the bundled fixture and surfaces a toast.

**Reasoning**: drift is most likely to appear after a football-data.org change. Catching it in CI means a bad payload never reaches production. The client-side check is a defense-in-depth net for an unrelated corruption (CDN flake, partial write).

**Rejected**: skipping client validation (a one-time payload corruption would silently render garbage), failing the client to a blank screen (worse UX than yesterday's data).

### 12.7 Service-worker cache invalidation

**Decision**: **`StaleWhileRevalidate` on `matches.json`**, combined with a **`visibilitychange` re-fetch** hook in the app shell.

**Reasoning**: SWR gives the user instant data and refreshes in the background; the visibility hook ensures users who leave a tab open all day see fresh data the moment they refocus. `autoUpdate` for the shell guarantees the SW itself doesn't pin a stale version of the app.

**Rejected**: `NetworkFirst` on data (defeats the offline goal), manual versioning via a query string (premature, fragile), service-worker `skipWaiting` + `clients.claim` shouting at every navigation (already implicit in `autoUpdate`).

---

## 13. Theming strategy

The theming layer answers two questions: (1) which theme does the user get on first paint, and (2) how does an override survive reload without flicker? The implementation lives in `src/shared/theme/` and `index.html`.

### 13.1 Token layer (source of truth)

Tokens are CSS custom properties defined exactly once for each theme. The light tokens go on `:root` (the default); the dark tokens are applied in two places to handle both the manual override and the OS preference:

```css
/* src/shared/ui/tokens.module.css (or :global block) */

:root {
  /* light tokens — see mockup main-view.html for the canonical palette */
  --bg-page:        #F6F5F0;
  --bg-card:        #FFFFFF;
  --bg-featured:    #FFFFFF;
  /* ...all light-mode tokens... */
  color-scheme: light;
}

/* OS preference path — only applies when no manual override is set */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg-page:        #0A0A0F;
    --bg-card:        #16161D;
    --bg-featured:    #1C1C26;
    /* ...all dark-mode tokens... */
    color-scheme: dark;
  }
}

/* Manual override path — wins over OS preference */
:root[data-theme="dark"] {
  --bg-page:        #0A0A0F;
  --bg-card:        #16161D;
  --bg-featured:    #1C1C26;
  /* ...all dark-mode tokens... */
  color-scheme: dark;
}
```

`:root:not([data-theme="light"])` inside the media query is the key guard: it lets a user who's on a dark OS but explicitly picked light still get the light theme. The three states are: no attribute (follow OS), `data-theme="light"` (force light), `data-theme="dark"` (force dark).

The `color-scheme` CSS property is declared **per theme** so browser-rendered chrome (scrollbars, native form controls, autofill backgrounds) follows the picked theme rather than the OS preference.

#### Featured-surface tokens (theme-aware)

The featured slot is the visual centerpiece of the app. Earlier iterations used a single dark slate (`#0F172A`) for `--bg-featured` in BOTH themes, which produced a heavy, monolithic block on the light page (`#F6F5F0`) — especially in `/preview` where five FeaturedCards stack. Common sport-app UX (ESPN, FotMob, OneFootball) shows light featured surfaces in light mode. We mirror that by making `--bg-featured` theme-aware:

| Token                       | Light                    | Dark      | Used by                                                                  |
| --------------------------- | ------------------------ | --------- | ------------------------------------------------------------------------ |
| `--bg-featured`             | `#FFFFFF`                | `#1C1C26` | FeaturedCard background base (under the derby radial halos)              |
| `--text-on-featured`        | `#0F172A` (slate-900)    | `#FFFFFF` | Country names, countdown, live text, CTA copy, multi/terminal headlines  |
| `--text-on-featured-muted`  | `#64748B` (slate-500)    | `#94A3B8` | Featured meta row, dot separators, countdown separators, CTA secondaries |
| `--halo-opacity`            | `0.18`                   | `0.32`    | Per-team radial-gradient stop on the featured background (via `color-mix`) |
| `--matchcard-halo-opacity`  | `0.08`                   | `0.14`    | Per-team radial-gradient stop on each MatchCard (§14.9)                    |

Notes:

- `--text-inverse` and `--text-inverse-muted` are KEPT — they remain the right primitive for "white text on an always-dark surface" (tooltips, future overlays, the brand mark gradient). The new `--text-on-featured*` tokens decouple "the text color the featured card needs" from "white" so the featured surface can flip with the theme.
- WCAG AA on body text:
  - Light: slate-900 (`#0F172A`) on `#FFFFFF` ≈ 16:1, slate-500 (`#64748B`) on `#FFFFFF` ≈ 6:1 — both pass AA.
  - Dark: `#FFFFFF` on `#1C1C26` ≈ 14:1, `#94A3B8` on `#1C1C26` ≈ 5.6:1 — both pass AA.
- Opacity tokens scale the team-color halos so derbies remain readable across themes (saturated team colors like Brazil yellow or Argentina celeste would otherwise overpower text on white). The featured `--halo-opacity` is lower in light (0.18) than dark (0.32) because saturated colors render perceptually stronger over white. See §14.4 for rationale.
- The LIVE-state extra red glow on the featured surface stays at a fixed 30% opacity (`color-mix(in srgb, var(--live) 30%, transparent)`) in BOTH themes — the LIVE signal MUST remain perceptually salient regardless of theme.

### 13.2 Pre-paint decision (no FOUC)

The `data-theme` attribute MUST be applied to `<html>` **before** any stylesheet renders. A tiny synchronous inline script in `index.html`, placed in `<head>` before any CSS link, reads `localStorage.wc-theme` and applies the attribute:

```html
<!-- index.html (excerpt, runs before any CSS resolves) -->
<script>
  (function () {
    try {
      var t = localStorage.getItem("wc-theme");
      if (t === "dark" || t === "light") {
        document.documentElement.setAttribute("data-theme", t);
      }
    } catch (_) { /* localStorage blocked → fall through to OS preference */ }
  })();
</script>
```

This script is inline, not bundled, intentionally — Vite would otherwise defer it past the first paint. The `try`/`catch` protects against Safari private mode and aggressive privacy extensions. If `localStorage` is unavailable, no attribute is set, and the OS-preference branch handles rendering.

Rejected: a Vue `onBeforeMount` hook (too late — runs after the bundle parses, which means a flash of the wrong theme), a CSS-only `@media (prefers-color-scheme: dark)` solution (no override capability), inlining the entire token stylesheet (bloats the HTML for marginal gain).

### 13.3 Override persistence

`localStorage.wc-theme` holds the user's explicit choice. The shape is constrained:

```ts
// src/shared/theme/storage.ts
export type StoredTheme = "light" | "dark";

const KEY = "wc-theme";

export function readStoredTheme(): StoredTheme | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch { return null; }
}

export function writeStoredTheme(theme: StoredTheme): void {
  try { localStorage.setItem(KEY, theme); } catch { /* noop */ }
}

export function clearStoredTheme(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
```

The key is namespaced (`wc-theme`) to avoid collision with any future app concern. Absence means "follow OS".

### 13.4 Composable

A single reactive source of truth, shared across components. The composable is a singleton at the module level — multiple call sites get the same state.

```ts
// src/shared/theme/use-theme.ts
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  readStoredTheme,
  writeStoredTheme,
  clearStoredTheme,
  type StoredTheme,
} from "./storage";

export type Theme = "light" | "dark";

// Module-scoped singleton state (no Pinia, per conventions §3).
const stored = ref<StoredTheme | null>(readStoredTheme());
const osPrefersDark = ref<boolean>(
  typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches,
);

const current = computed<Theme>(() =>
  stored.value ?? (osPrefersDark.value ? "dark" : "light"),
);

export interface UseTheme {
  readonly current: Readonly<typeof current>;
  setTheme(theme: Theme): void;
  clearOverride(): void;
}

export function useTheme(): UseTheme {
  // Listen for OS changes so users who never override stay in sync.
  onMounted(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent): void => {
      osPrefersDark.value = e.matches;
    };
    mq.addEventListener("change", onChange);
    onUnmounted(() => mq.removeEventListener("change", onChange));
  });

  function setTheme(theme: Theme): void {
    stored.value = theme;
    writeStoredTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
  }

  function clearOverride(): void {
    stored.value = null;
    clearStoredTheme();
    document.documentElement.removeAttribute("data-theme");
  }

  return { current, setTheme, clearOverride };
}
```

Notes:

- `current` is a `ComputedRef<Theme>` — read-only to consumers, derived from `stored` and `osPrefersDark`.
- The `matchMedia` listener is set up once per mount; since `stored` and `osPrefersDark` are module-scoped singletons, multiple components mounting/unmounting do not cause duplicate listeners *per state slot*, but they do add and clean up their own listener — acceptable, listeners are cheap and `matchMedia` deduplicates internally. If this becomes a real concern, the listener moves into `app/main.ts` and the composable just reads.
- Calls to `setTheme` and `clearOverride` write to the DOM imperatively (`setAttribute`) because the CSS selectors depend on the attribute. Vue's reactivity does not bind to HTML element attributes outside of templates.

---

## 14. Visual identity & flag presentation

The featured slot is the visual centerpiece. The treatment in `mockups/main-view.html` is the canonical reference: circular flag medallions, an italic "VS" stamp between them, country names below, and a soft team-color halo on the featured background. This section commits to the implementation.

### 14.1 Flag asset source

**DECISION: bundle SVG flag assets at build time**, sourced from the `circle-flags` package. Only ISO-alpha-2 codes that can appear in the FIFA World Cup 2026 fixture (~48 countries) are copied into `src/shared/flags/`. Vite imports them via `?url` for the `<img src>` case and as inline SVG for the featured medallions (where we want to apply CSS filters or animations if needed later).

Rejected alternatives, each in one line:

- **Runtime CDN (e.g. `hatscripts.github.io/circle-flags/`)**: breaks offline-first, supply-chain risk, no SW caching guarantees on third-party origins.
- **Emoji flags (`🇦🇷`)**: rendering is platform-dependent (Windows shows letters, some Linux distros show blanks), no "derby" feel, no size control.
- **A flag icon font**: requires loading a 100KB+ font on first paint for ~48 glyphs we actually use.

### 14.2 Naming and resolution

Files live at `src/shared/flags/{iso}.svg` where `{iso}` is lowercase ISO-alpha-2. Examples: `ar.svg`, `ma.svg`, `mx.svg`, `jp.svg`.

A typed resolver guards against missing assets:

```ts
// src/shared/flags/resolve.ts
import type { ImportedAsset } from "@/shared/types/vite";

// Vite eagerly globs known flags at build time.
const flagModules = import.meta.glob<ImportedAsset>(
  "./*.svg",
  { eager: true, query: "?url", import: "default" },
);

export function resolveFlag(iso: string): string | null {
  const key = `./${iso.toLowerCase()}.svg`;
  return flagModules[key] ?? null;
}
```

`resolveFlag` returns `null` for unknown ISO codes — the UI falls back to a neutral placeholder medallion (a circular gradient with the team's three-letter code centered). Domain code never imports flags; only the UI does.

### 14.3 Featured medallion

Sizing and treatment (per mockup):

- **Diameter**: 88px.
- **Shape**: perfect circle (`border-radius: 999px`), `object-fit: cover` so flag artwork is centered.
- **Inner ring**: `inset 0 0 0 2px rgba(255, 255, 255, 0.18)` (light) or `rgba(255, 255, 255, 0.12)` (dark), token: `--ring-flag`.
- **Outer drop shadow**: `0 8px 24px rgba(0, 0, 0, 0.25)` (light) or `rgba(0, 0, 0, 0.5)` (dark), token: `--ring-flag-shadow`.
- **Top highlight**: a `::after` pseudo with `inset 0 1px 0 rgba(255, 255, 255, 0.20)` to suggest a glass surface.

Mini medallions (in the matches list): 24px diameter, same circular shape, with a 1px inner border (`inset 0 0 0 1px var(--border)`).

### 14.4 Derby halo

The featured background is a stack of two radial gradients on top of the base surface token. The team-color tints are passed as bare hex colors via two CSS custom properties; their on-card opacity is centrally controlled by the theme-aware `--halo-opacity` token (§13.1) via `color-mix`:

```css
.featured {
  background:
    radial-gradient(circle at 18% 50%,
      color-mix(in srgb, var(--team-a-glow, transparent) calc(var(--halo-opacity) * 100%), transparent) 0%,
      transparent 45%),
    radial-gradient(circle at 82% 50%,
      color-mix(in srgb, var(--team-b-glow, transparent) calc(var(--halo-opacity) * 100%), transparent) 0%,
      transparent 45%),
    var(--bg-featured);
}
```

- Left halo (`18% 50%`) is tinted by team A's primary color.
- Right halo (`82% 50%`) is tinted by team B's primary color.
- Tints are passed in as CSS custom properties (`--team-a-glow`, `--team-b-glow`) on the element style attribute, resolved from the lookup table (§14.6). They are bare hex colors — opacity is applied via the `--halo-opacity` token, not baked into the value.
- Defaults (`var(..., transparent)`) cover the edge case where the custom property is unset — the halo gracefully degrades to the base `--bg-featured`.
- `--halo-opacity` is theme-driven: `0.18` in light, `0.32` in dark. Saturated team colors over white read perceptually stronger than over dark slate, so the light-mode halo is intentionally dialed down to keep WCAG AA contrast on body text.

Rejected alternatives:

- **Fixed cross-theme opacity (e.g. 0.30 in both)**: looked correct in dark but team colors saturated on the new white featured surface — yellow, red, and celeste all bled into the text area and pushed slate-500 meta copy under AA. The opacity token decouples this concern from the surface choice.
- **Per-color manual tuning (a different opacity per ISO)**: high maintenance, table grows unboundedly. The two-bucket (light/dark) opacity covers the common case; outlier flags (Brazil yellow, white-derived) are flagged in §16 risks.

### 14.5 Typography & "VS" stamp

- **Country names**: uppercase, `font-weight: 800`, `letter-spacing: 0.04em`, centered below the medallion, color `var(--text-inverse)`.
- **"VS" stamp**: 44px circular pill, `border-only` style (`1.5px solid rgba(255,255,255,0.20)`), italic `font-weight: 900`, `letter-spacing: 0.06em`. Lifted 22px upward with `margin-top: -22px` so it visually sits between the medallions, not below them.

### 14.6 Team-color lookup table

A curated map keyed by ISO-alpha-2, colocated with the flag assets so future updates touch one folder:

```ts
// src/shared/flags/team-colors.ts
export interface TeamGlow {
  /** RGBA string used directly in the radial-gradient stop. */
  readonly glow: string;
}

export const TEAM_COLORS: Readonly<Record<string, TeamGlow>> = {
  ar: { glow: "rgba(108, 175, 245, 0.32)" }, // Argentina celeste
  br: { glow: "rgba(34, 197, 94, 0.32)"  }, // Brasil verde
  ma: { glow: "rgba(193, 39, 45, 0.32)"  }, // Marruecos rojo
  mx: { glow: "rgba(0, 104, 71, 0.32)"   }, // México verde
  jp: { glow: "rgba(188, 0, 45, 0.32)"   }, // Japón rojo
  // ... ~48 entries total, one primary per country
};

const FALLBACK_GLOW = "rgba(34, 197, 94, 0.24)"; // brand accent, dialed back

export function resolveGlow(iso: string): string {
  return TEAM_COLORS[iso.toLowerCase()]?.glow ?? FALLBACK_GLOW;
}
```

**Picked-one-primary policy**: countries with multiple official primary colors (e.g. France blue/white/red) get a single canonical pick — the most identity-defining one. Trade-off accepted: documented in §16 risks.

The featured component receives the two ISO codes and resolves halos at render time:

```vue
<!-- src/featured/ui/FeaturedCard.vue (excerpt) -->
<script setup lang="ts">
import { computed } from "vue";
import type { Match } from "@/matches/domain/match";
import { resolveGlow } from "@/shared/flags/team-colors";

const props = defineProps<{ match: Match }>();

const haloStyle = computed(() => ({
  "--team-a-glow": resolveGlow(props.match.home.id),
  "--team-b-glow": resolveGlow(props.match.away.id),
}));
</script>

<template>
  <section class="featured" :style="haloStyle">
    <!-- derby tableau, countdown, meta, CTA -->
  </section>
</template>
```

### 14.7 Multi-live state

**No derby tableau** for `multi-live`. The featured slot collapses into a single summary card ("Hay N partidos en vivo — mirá la lista") with an aggregated visual treatment — see the `featured.md` spec for the exact composition. Rationale already in §12.4: cycling carousels and split mini-cards both lose more than they gain.

### 14.8 live-single in-progress indicator (text, no score)

In the `live-single` state the featured card MUST display the localized in-progress text (`t('featured.live.text')`) centered in the slot's primary content area. NO score block, NO match clock, NO fabricated minute mark. Visual contract:

- **Typographic treatment**: same family and weight class as the other featured-slot primary content (country names, countdown). This signals the text is informational content, not a banner.
- **Surrounding context**: the eyebrow label (top, `t('featured.eyebrow.live')`) and the derby tableau (medallions + country names + VS stamp) remain as in `upcoming-today` / `upcoming-future`. Liveness is communicated by the combination of:
  1. The eyebrow shifting from "Próximo partido" / "Next match" to "En vivo" / "Live".
  2. The countdown disappearing.
  3. The localized in-progress text appearing in the slot where the countdown used to live.
- **What is explicitly NOT rendered**: a score block, a `0-0` placeholder, a dash, a "live" minute counter, or any number that could be mistaken for in-flight game data. The renderer MUST defensively ignore `match.score` while the state is `live-single` even if the field is present in the payload (it may be a stale snapshot from a prior daily refresh).

Rationale (also captured in `proposal.md` §5 non-goals and `featured.md` §4.1): the daily-refresh pipeline cannot honestly source real-time scores; surfacing one would mislead the user about its freshness. The text indicator is the correct trade-off given the architecture.

The list view (`MatchCard`) follows the same rule for `live` rows — badge only, no score — and DOES render the score for `finished` rows once the next daily refresh backfills it. See `matches.md` §5.1.

### 14.9 MatchCard team-color halo

The list view rows are visually generic: a neutral `--bg-card` background, a border, and badges. Stacked under a light featured card the entire match list reads as one undifferentiated block. The fix carries the derby identity from the featured slot down into each row in a much more restrained form — a subtle two-edge halo of each team's primary color over the base card surface.

- Each `MatchCard` sets `--team-a-glow` and `--team-b-glow` as inline CSS custom properties on its root `<li>`, resolved via `resolveGlow(iso)` from `src/shared/flags/team-colors.ts` (same lookup the FeaturedCard uses).
- The background composes TWO radial gradients (one anchored at `0% 50%` for team A, one at `100% 50%` for team B) over the existing `--bg-card` token:

```css
.match {
  background:
    radial-gradient(circle at 0% 50%,
      color-mix(in srgb, var(--team-a-glow, transparent) calc(var(--matchcard-halo-opacity) * 100%), transparent) 0%,
      transparent 45%),
    radial-gradient(circle at 100% 50%,
      color-mix(in srgb, var(--team-b-glow, transparent) calc(var(--matchcard-halo-opacity) * 100%), transparent) 0%,
      transparent 45%),
    var(--bg-card);
}
```

- Opacity is theme-driven via the new `--matchcard-halo-opacity` token (§13.1): `0.08` light, `0.14` dark. These are roughly half the featured values because the list rows are denser, and an even moderate tint here cumulatively dominates the column.
- The gradients fade to `transparent` at 45% — the center of each row (where the team names, time, and badge live) is essentially neutral, preserving text contrast against `--bg-card`.
- The team colors "bleed in" from the edges. Effect: the row visually inherits each team's identity at the flag-medallion side without compromising legibility.

Rejected alternatives:

- **Solid colored left border** (e.g. a 4px slab of team A's color): too aggressive at scale (the eye reads a list of saturated bars rather than a list of matches), and only carries one team's color per row.
- **Full background tint** of the row in a mixed team color: kills text contrast on body copy, especially for high-luminance teams (Brazil yellow, white-derived flags).
- **Per-team accent badges next to the country name**: visually noisy in a long list, redundant with the flag medallion, and breaks the existing `.badge` semantic (which already encodes status).
- **Single-edge halo with a blended color** (e.g. one gradient mixing both teams): obscures which color belongs to which team; the two-edge composition is the cheapest way to keep that signal.

---

## 17. i18n strategy

> Numbering note: this section is labelled §17 (not §15) because the
> Testing strategy (§15) and Risks (§16) sections were already
> stable references from `tasks.md`. Adding the i18n strategy with
> a fresh number avoided cascading renumbering across the project.
> Thematically, i18n belongs alongside Theming (§13) and Visual
> identity (§14); it appears here in the file for that reason.

The i18n layer answers three questions: (1) which locale does the user get on first paint, (2) how does an override survive reload, and (3) how do we keep every string and every country name reachable through a single typed map. The implementation lives in `src/shared/i18n/`.

### 17.1 Token / source-of-truth

A typed `MESSAGES` map keyed by locale and by `MessageKey`. The `MessageKey` union is the closed enumeration of every user-facing string; missing keys are compile-time errors.

```ts
// src/shared/i18n/messages.ts
export type Locale = "es" | "en";

export type MessageKey =
  | "featured.eyebrow.upcomingToday"
  | "featured.eyebrow.upcomingFuture"
  | "featured.eyebrow.live"
  | "featured.live.text"
  | "featured.multiLive.title"
  | "featured.multiLive.hint"
  | "featured.tournamentOver.title"
  | "featured.tournamentOver.subtitle"
  | "featured.meta.localTime"
  | "match.badge.scheduled"
  | "match.badge.live"
  | "match.badge.finished"
  | "match.badge.postponed"
  | "match.badge.next"
  | "match.group"
  | "stage.group"
  | "stage.roundOf32"
  | "stage.roundOf16"
  | "stage.quarterFinal"
  | "stage.semiFinal"
  | "stage.thirdPlace"
  | "stage.final"
  | "list.title"
  | "list.count"
  | "list.empty"
  | "header.subtitle"
  | "theme.toggle.toDark"
  | "theme.toggle.toLight"
  | "locale.toggle.toEs"
  | "locale.toggle.toEn"
  | "footer.lastUpdate"
  | "footer.offline"
  | "time.daysCount"
  | "nav.openGallery"
  | "nav.backToMain"
  | "preview.page.title"
  | "preview.page.intro"
  | "preview.featured.liveSingle.description"
  | "preview.featured.liveMultiple.description"
  | "preview.featured.upcomingToday.description"
  | "preview.featured.upcomingFuture.description"
  | "preview.featured.tournamentOver.description"
  | "preview.section.matchCard"
  | "preview.section.countdown"
  | "preview.section.matchesList"
  | "preview.main.placeholder.title"
  | "preview.main.placeholder.body"
  | "notifications.cta.idle"
  | "notifications.cta.requesting"
  | "notifications.cta.granted"
  | "notifications.cta.denied.title"
  | "notifications.cta.denied.hint"
  | "notification.body"
  | "data.stale.history"
  | "data.stale.fixture"
  | "preview.section.daySelector"
  | "day.label"
  | "day.today"
  | "day.empty"
  | "day.selector.aria";

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  es: {
    "featured.eyebrow.upcomingToday": "Próximo partido",
    "featured.eyebrow.upcomingFuture": "Próximo partido",
    "featured.eyebrow.live":           "En vivo",
    "featured.live.text":              "Se está jugando ahora",
    "featured.multiLive.title":        "Hay {n} partidos en vivo",
    "featured.multiLive.hint":         "Mirá la lista abajo",
    "featured.tournamentOver.title":   "El Mundial 2026 ha terminado",
    "featured.tournamentOver.subtitle":"Hasta la próxima edición",
    "featured.meta.localTime":         "hora local",
    "match.badge.scheduled":           "Programado",
    "match.badge.live":                "En vivo",
    "match.badge.finished":            "Final",
    "match.badge.postponed":           "Postergado",
    "match.badge.next":                "Siguiente",
    "match.group":                     "Grupo {letter}",
    "stage.group":                     "Fase de grupos",
    "stage.roundOf32":                 "Dieciseisavos",
    "stage.roundOf16":                 "Octavos",
    "stage.quarterFinal":              "Cuartos de final",
    "stage.semiFinal":                 "Semifinales",
    "stage.thirdPlace":                "Tercer puesto",
    "stage.final":                     "Final",
    "list.title":                      "Partidos del día",
    "list.count":                      "{n} partidos",
    "list.empty":                      "No hay partidos hoy",
    "header.subtitle":                 "Mundial 2026",
    "theme.toggle.toDark":             "Cambiar a modo oscuro",
    "theme.toggle.toLight":            "Cambiar a modo claro",
    "locale.toggle.toEs":              "Cambiar a español",
    "locale.toggle.toEn":              "Cambiar a inglés",
    "footer.lastUpdate":               "Datos actualizados hace {time}",
    "footer.offline":                  "Funciona offline",
    "time.daysCount":                  "{n} días",
    "nav.openGallery":                 "Galería de componentes",
    "nav.backToMain":                  "Volver al inicio",
    "preview.page.title":              "Galería de componentes",
    "preview.page.intro":              "Vista de todos los estados de los componentes en un solo lugar.",
    "preview.featured.liveSingle.description":     "Un partido se está jugando",
    "preview.featured.liveMultiple.description":   "Varios partidos en simultáneo",
    "preview.featured.upcomingToday.description":  "Próximo partido del día",
    "preview.featured.upcomingFuture.description": "Próximo partido en otro día",
    "preview.featured.tournamentOver.description": "El Mundial terminó",
    "preview.section.matchCard":       "Tarjeta de partido en cada estado",
    "preview.section.countdown":       "Cuenta regresiva aislada",
    "preview.section.matchesList":     "Listado de partidos",
    "preview.main.placeholder.title":  "Próximamente",
    "preview.main.placeholder.body":   "La app principal aparece acá cuando se complete el batch B-2.",
    "notifications.cta.idle":          "Avisame 15 min antes",
    "notifications.cta.requesting":    "Solicitando permiso…",
    "notifications.cta.granted":       "✓ Avisos activos",
    "notifications.cta.denied.title":  "Avisos bloqueados",
    "notifications.cta.denied.hint":   "Activá los avisos del navegador para recibirlos",
    "notification.body":               "Empieza en {n} minutos",
    "data.stale.history":              "Mostrando datos guardados",
    "data.stale.fixture":              "Mostrando datos de respaldo",
    "preview.section.daySelector":     "Tira de selección de días",
    "day.label":                       "Día {n}",
    "day.today":                       "Hoy",
    "day.empty":                       "Sin partidos este día",
    "day.selector.aria":               "Seleccionar día del torneo",
  },
  en: {
    "featured.eyebrow.upcomingToday": "Next match",
    "featured.eyebrow.upcomingFuture": "Next match",
    "featured.eyebrow.live":           "Live",
    "featured.live.text":              "Playing now",
    "featured.multiLive.title":        "{n} matches live now",
    "featured.multiLive.hint":         "See the list below",
    "featured.tournamentOver.title":   "The 2026 World Cup is over",
    "featured.tournamentOver.subtitle":"Until next time",
    "featured.meta.localTime":         "local time",
    "match.badge.scheduled":           "Scheduled",
    "match.badge.live":                "Live",
    "match.badge.finished":            "Final",
    "match.badge.postponed":           "Postponed",
    "match.badge.next":                "Next",
    "match.group":                     "Group {letter}",
    "stage.group":                     "Group stage",
    "stage.roundOf32":                 "Round of 32",
    "stage.roundOf16":                 "Round of 16",
    "stage.quarterFinal":              "Quarter-finals",
    "stage.semiFinal":                 "Semi-finals",
    "stage.thirdPlace":                "Third place",
    "stage.final":                     "Final",
    "list.title":                      "Matches of the day",
    "list.count":                      "{n} matches",
    "list.empty":                      "No matches today",
    "header.subtitle":                 "World Cup 2026",
    "theme.toggle.toDark":             "Switch to dark mode",
    "theme.toggle.toLight":            "Switch to light mode",
    "locale.toggle.toEs":              "Switch to Spanish",
    "locale.toggle.toEn":              "Switch to English",
    "footer.lastUpdate":               "Data updated {time} ago",
    "footer.offline":                  "Works offline",
    "time.daysCount":                  "{n} days",
    "nav.openGallery":                 "Component gallery",
    "nav.backToMain":                  "Back to main",
    "preview.page.title":              "Component gallery",
    "preview.page.intro":              "All component states in one place.",
    "preview.featured.liveSingle.description":     "One match in progress",
    "preview.featured.liveMultiple.description":   "Multiple matches in progress",
    "preview.featured.upcomingToday.description":  "Next match today",
    "preview.featured.upcomingFuture.description": "Next match on another day",
    "preview.featured.tournamentOver.description": "The World Cup is over",
    "preview.section.matchCard":       "Match card in each state",
    "preview.section.countdown":       "Standalone countdown",
    "preview.section.matchesList":     "Matches list",
    "preview.main.placeholder.title":  "Coming soon",
    "preview.main.placeholder.body":   "The main app appears here once batch B-2 lands.",
    "notifications.cta.idle":          "Remind me 15 min before",
    "notifications.cta.requesting":    "Requesting permission…",
    "notifications.cta.granted":       "✓ Notifications enabled",
    "notifications.cta.denied.title":  "Notifications blocked",
    "notifications.cta.denied.hint":   "Enable notifications in your browser to receive them",
    "notification.body":               "Starts in {n} minutes",
    "data.stale.history":              "Showing saved data",
    "data.stale.fixture":              "Showing fallback data",
    "preview.section.daySelector":     "Day selector strip",
    "day.label":                       "Day {n}",
    "day.today":                       "Today",
    "day.empty":                       "No matches this day",
    "day.selector.aria":               "Select tournament day",
  },
};
```

The `Record<Locale, Record<MessageKey, string>>` shape forces both locales to be complete and exhaustive. Adding a `MessageKey` without providing both translations is a TypeScript error.

### 17.2 Detection: `readLocaleFromBrowser()`

```ts
// src/shared/i18n/detect.ts
import type { Locale } from "./messages";

const SUPPORTED: readonly Locale[] = ["es", "en"];

function parsePrefix(tag: string | undefined): Locale | null {
  if (!tag) return null;
  const prefix = tag.toLowerCase().split("-")[0];
  return SUPPORTED.includes(prefix as Locale) ? (prefix as Locale) : null;
}

export function readLocaleFromBrowser(): Locale {
  if (typeof navigator === "undefined") return "es";

  const primary = parsePrefix(navigator.language);
  if (primary !== null) return primary;

  const list = navigator.languages ?? [];
  for (const tag of list) {
    const match = parsePrefix(tag);
    if (match !== null) return match;
  }

  return "es"; // default fallback
}
```

Rules:
- `navigator.language` wins when it parses to a supported prefix.
- `navigator.languages` (the ordered preference list) is consulted only if the primary is unsupported.
- Default fallback is `"es"`.

### 17.3 Storage: `localStorage.wc-locale`

Mirrors the theme storage pattern (`design.md` §13.3). One key, one value of type `Locale | null`.

```ts
// src/shared/i18n/storage.ts
import type { Locale } from "./messages";

const KEY = "wc-locale";

export function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "es" || raw === "en" ? raw : null;
  } catch { return null; }
}

export function writeStoredLocale(locale: Locale): void {
  try { localStorage.setItem(KEY, locale); } catch { /* noop */ }
}

export function clearStoredLocale(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
```

The key is namespaced (`wc-locale`) to mirror `wc-theme`. Absence means "follow browser detection".

### 17.4 Interpolation

A tiny `interpolate(template, params?)` helper for `{n}`-style placeholders. No framework, no AST — a single `replace` call.

```ts
// src/shared/i18n/interpolate.ts
export type InterpolateParams = Readonly<Record<string, string | number>>;

export function interpolate(template: string, params?: InterpolateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
```

Used by `t()` whenever a key contains a `{x}` token (e.g. `list.count: "{n} partidos"`). Missing params leave the placeholder verbatim — a developer-visible signal that something was forgotten.

### 17.5 Composable: `useI18n()`

Module-scoped singleton (no Pinia, per conventions §3). Mirrors the `useTheme()` pattern exactly.

```ts
// src/shared/i18n/use-i18n.ts
import { ref, computed } from "vue";
import {
  MESSAGES,
  type Locale,
  type MessageKey,
} from "./messages";
import {
  readStoredLocale,
  writeStoredLocale,
  clearStoredLocale,
} from "./storage";
import { readLocaleFromBrowser } from "./detect";
import { interpolate, type InterpolateParams } from "./interpolate";
import { COUNTRY_NAMES } from "./country-names";

// Module-scoped singleton — initialized synchronously at module load
// so the first render reads the correct locale (no flicker).
const stored = ref<Locale | null>(readStoredLocale());
const detected = ref<Locale>(readLocaleFromBrowser());

const current = computed<Locale>(() => stored.value ?? detected.value);

function t(key: MessageKey, params?: InterpolateParams): string {
  const table = MESSAGES[current.value];
  const template = table[key];
  if (template === undefined) {
    // Defensive: in-source callers are type-checked, but a dynamic
    // call could still miss. Return the key itself per spec §7.
    console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return interpolate(template, params);
}

function country(iso: string): string | null {
  const table = COUNTRY_NAMES[current.value];
  return table[iso.toLowerCase()] ?? null;
}

function setLocale(locale: Locale): void {
  stored.value = locale;
  writeStoredLocale(locale);
  document.documentElement.setAttribute("lang", locale);
}

function clearOverride(): void {
  stored.value = null;
  clearStoredLocale();
  document.documentElement.setAttribute("lang", current.value);
}

export interface UseI18n {
  readonly current: Readonly<typeof current>;
  t: typeof t;
  country: typeof country;
  setLocale: typeof setLocale;
  clearOverride: typeof clearOverride;
}

export function useI18n(): UseI18n {
  return { current, t, country, setLocale, clearOverride };
}
```

Notes:
- The `stored` and `detected` refs are initialized at module load — synchronous — so the first call to `t()` from a component template returns the correct locale on the first render. No `onMounted` race.
- `setLocale` and `clearOverride` imperatively update `<html lang>` for screen-reader pronunciation. The composition root MAY also set `<html lang>` once at boot from `current.value`.
- `country(iso)` returns `null` for unknown ISOs; callers do `country(iso) ?? team.name` to honor `i18n.md` §4.1.

### 17.6 Country names: `COUNTRY_NAMES`

A second typed map, separate from `MESSAGES` because:
- The key space is unbounded (any ISO-alpha-2 code that may appear in the data).
- The lookup is not type-checked the same way (a missing entry is acceptable; we fall back to `team.name`).

```ts
// src/shared/i18n/country-names.ts
import type { Locale } from "./messages";

export const COUNTRY_NAMES: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  es: {
    ar: "Argentina",
    br: "Brasil",
    mx: "México",
    us: "Estados Unidos",
    ca: "Canadá",
    ma: "Marruecos",
    jp: "Japón",
    // ... ~48 entries, one per WC 2026 country
  },
  en: {
    ar: "Argentina",
    br: "Brazil",
    mx: "Mexico",
    us: "United States",
    ca: "Canada",
    ma: "Morocco",
    jp: "Japan",
    // ... ~48 entries
  },
};
```

Resolution rule, enforced by callers: `country(iso) ?? team.name`. The data field is the safety net for unknown ISOs. See `i18n.md` AC-10.

### 17.7 Rejected alternative — vue-i18n

`vue-i18n` is the canonical Vue 3 i18n library. It supports pluralization, number/date formatting, lazy locale loading, and SFC `<i18n>` blocks. For an app with ~32 keys, two locales, and zero plural-rule complexity, it is overkill:

- Bundle weight: vue-i18n core is ~10KB gzipped before any messages; our entire i18n module here is <100 lines.
- Conceptual surface: pluralization rules, `$t` injection, message compilation, scope inheritance — none of these solve a problem we have.
- Type-safety: vue-i18n's TS story is improving but still relies on declaration-merging tricks; a hand-rolled `Record<Locale, Record<MessageKey, string>>` is type-safe at the language level.

We reject vue-i18n for MVP. If the locale list grows past 5, or if plural rules become a real concern (currently they don't — none of the 32 keys have plural variants beyond `{n}` interpolation), we can revisit.

### 17.8 Type sketches summary

```ts
// Public types
export type Locale = "es" | "en";

export type MessageKey =
  | "featured.eyebrow.upcomingToday"
  | /* ... 31 more ... */
  | "footer.offline";

export interface UseI18n {
  readonly current: ComputedRef<Locale>;
  t(key: MessageKey, params?: Readonly<Record<string, string | number>>): string;
  country(iso: string): string | null;
  setLocale(locale: Locale): void;
  clearOverride(): void;
}
```

Consumers import `useI18n` and call `const { t, country } = useI18n()` in their `<script setup>`. The composable's singleton state means switching locale in one component re-renders every other component on the same tick.

---

## 15. Testing strategy

Three layers, each tied to what they're good at. No coverage gate yet — quality of assertions over headline percentage.

**Unit (Vitest)** — pure functions, deterministic:
- `selectFeaturedState` — one test per state variant, plus tiebreaker tests (two simultaneous live, two simultaneous upcoming, tournament-over boundary).
- `planSchedule` — past matches filtered out, lead time honored, postponed excluded.
- `todayBounds`, `isLive`, `isUpcoming` — DST edge inputs, half-hour-offset fixtures.
- `matchListSchema` — accepts a valid payload, rejects each known shape violation (missing `utcKickoff`, wrong status, bad stage).
- `useCountdown` math — feed an injectable clock, assert `remaining` decrements as expected and clamps at zero.
- `useTheme()` — four cases:
  1. Initial resolution honors OS preference when no stored override exists (`matchMedia` stubbed to return `true` → `current === "dark"`).
  2. `setTheme("light")` flips `current` to `"light"`, writes `localStorage.wc-theme`, and applies `data-theme="light"` on `<html>`.
  3. Override persists across a fresh `useTheme()` invocation in a new module-scope simulation (reload-equivalent: re-import + new ref).
  4. `clearOverride()` removes `localStorage.wc-theme`, removes the `data-theme` attribute, and returns `current` to whatever OS preference reports.
- `chooseSource` adapter chain — three cases:
  1. Current `RemoteSource` returns valid payload → result is the remote data, `HistorySource` and fixture are NOT consulted (assert on spies).
  2. Current `RemoteSource` throws (or returns invalid → Zod throws inside) → `HistorySource` is consulted next; if it succeeds, the chain stops there.
  3. Both `RemoteSource` and `HistorySource` fail → fixture is used; result equals the bundled fixture.
- `getRefreshMode(now)` — boundary-date assertions:
  1. UTC date equal to `TOURNAMENT_START_UTC` → `"tournament"`.
  2. UTC date equal to `TOURNAMENT_END_UTC` → `"tournament"` (inclusive).
  3. UTC date one day before `TOURNAMENT_START_UTC` → `"near"`.
  4. UTC date `NEAR_LEAD_DAYS` days before kickoff → `"near"` (inclusive boundary).
  5. UTC date `NEAR_LEAD_DAYS + 1` days before kickoff → `"off"`.
  6. UTC date `NEAR_TAIL_DAYS` days after the final → `"near"`.
  7. UTC date `NEAR_TAIL_DAYS + 1` days after the final → `"off"`.
- `shouldFetch(mode, today, lastRefresh)` — table-driven: `"off"` → always `false`; `"tournament"` with `lastRefresh === null` or `diffDays >= 1` → `true`; `"near"` with `diffDays >= 2` → `true`, else `false`.

**Component (Vue Test Utils)** — UI invariants:
- `FeaturedCard` — renders each `FeaturedState.kind` correctly, calls correct CTA on click.
- `FeaturedCard` in dark mode — mount with `<html data-theme="dark">` (set in a `beforeEach`), assert that the computed inline `--team-a-glow` / `--team-b-glow` custom properties are applied and that the rendered DOM reflects the dark-token classes. Snapshot acceptable here since the dark-mode markup differs only by attribute/custom-property values, not structure.
- `Countdown` — renders `HH:MM:SS`, updates on tick, hides at zero.

**E2E (Playwright smoke)** — one happy path:
- Visit the deployed/preview URL → see the featured section → see today's list → click "Avisame 15 min antes" → permission dialog stub → button flips to confirmation. Service worker registered. App shell loads offline (Playwright `context.setOffline(true)` reload).

Injectable clock: `src/shared/time/now.ts` exports `getNow()` defaulting to `Date.now`, overridable in tests via a module-level setter. Domain code calls `getNow()` instead of `Date.now()` directly.

For `useTheme()` and `getRefreshMode` tests, `matchMedia` and `localStorage` are stubbed via Vitest's `vi.stubGlobal` / `happy-dom` env, and `Date.now()` is controlled via the `getNow()` seam.

---

## 16. Risks & follow-ups

- **`showTrigger` API removal**: the API is non-standardized and could be removed by Chromium. If that happens, the SW + `setTimeout` path remains; user impact is "less reliable background notifications", not "no notifications". Tracked for re-evaluation post-MVP.
- **football-data.org free tier**: rate limits and availability are not guaranteed. The daily cron + fixture fallback mitigate. If the source becomes unusable, the manual fixture becomes the primary; a follow-up change can switch providers.
- **No analytics**: we ship blind. Acceptable for MVP; a future change may introduce a privacy-respecting page-view counter.
- **No A/B on permission CTA**: we commit to "gated CTA after first render" without data. Post-tournament retrospective should review grant rates.
- **Stage display copy in Spanish**: the `Stage` union is in English for code; rendering passes through a translation map. The map is part of the UI components, not the type. Documented here as a non-issue but a place where future i18n would hook in.
- **Time zone of the device clock itself**: we trust `Date.now()`. If a user's device clock is wrong by minutes, countdowns are wrong by minutes. No mitigation planned for MVP.
- **Service worker storage quota**: `matches.json` is small (KB-scale). The HTML and asset caches are bounded by Workbox defaults. No quota exhaustion expected during the tournament window.
- **Bundle size from flag SVGs**: bundling SVG flags inflates the bundle. Mitigated by shipping only the ISO codes that can appear in the 2026 fixture (~48 countries × a few KB each = single-digit hundreds of KB pre-compression, much less gzipped). If this becomes a measurable performance problem, lazy-load the featured medallions and keep mini-flags inline.
- **Team-color halo lookup accuracy**: countries with multiple primary colors (France blue/white/red, Germany black/red/gold) may look off-brand under the picked-one-primary policy. Documented and accepted for MVP. The `FALLBACK_GLOW` (neutral brand accent) covers any ISO code not present in the lookup table. Post-MVP, a designer pass can refine ambiguous picks.
- **Static manifest theme color**: the PWA manifest's `theme_color` is a single value and cannot perfectly match both light and dark modes. The chosen neutral mid-tone (`#16161D`) is a compromise that reads acceptably in both. JS-driven manifest mutation was rejected for cross-browser inconsistency (see §9.1). If user feedback flags the install-time splash color in light mode as jarring, post-MVP can revisit.
- **Hardcoded tournament window constants**: `TOURNAMENT_START_UTC` and `TOURNAMENT_END_UTC` live in `scripts/refresh/tournament.ts`. If FIFA reschedules the kickoff or the final, a code change + deploy is required to update the refresh window. Documented, not blocking — schedule changes of this magnitude are rare and a 30-day lead-in window absorbs minor shifts.
- **History-manifest staleness on GH Pages**: the manifest is `CacheFirst` with a 6h TTL (§9). Worst case, a user offline for >6h after a refresh sees a one-snapshot-stale `index.json`. The chain still works (the named file is also cached), and the next online visit refreshes the manifest.

These items are deferred to follow-up changes if the MVP needs them. None block implementation today.
