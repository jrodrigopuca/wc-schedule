// `Notification.showTrigger` adapter (Phase 9b). This is the SOLE
// production notifier — see design.md §8 / §12.2.
//
// How it works:
//   1. The page asks the SW for `navigator.serviceWorker.ready` (the
//      active registration that owns the origin).
//   2. For each upcoming match, the page calls
//      `registration.showNotification(title, { ..., showTrigger:
//      new TimestampTrigger(fireAtMs) })`.
//   3. The OS stores the pending notification and delivers it at
//      `fireAtMs` — even if the tab is closed and the SW is asleep.
//   4. `registration.getNotifications({ includeTriggered: false })`
//      returns pending-trigger entries; we close them to cancel.
//
// ── Content resolution timing (LOCKED) ────────────────────────────────
// Unlike the `timeout-notifier`, title and body are rendered at SCHEDULE
// time. The OS holds the rendered string; the SW does not re-render at
// fire time. A locale switch AFTER scheduling will NOT translate the
// pending notifications. To honor a locale change, the user must trigger
// a re-schedule by (a) re-granting permission, (b) reloading the app
// which kicks off `useNotifications().schedule(...)` on boot, or (c)
// the next `matches` mutation cascading into a re-plan. Documented in
// design.md §8 and risks below.
//
// ── Atomicity & cross-session cleanup ─────────────────────────────────
// Every `schedule()` call automatically closes any prior notifications
// registered by this app that aren't in the new plan. This handles the
// cross-session cancelled/postponed match case: if the user closed the
// tab, the match got cancelled in the next daily refresh, then the user
// re-opens — the orphan pending notification gets closed before we
// re-arm the new plan. We do this by enumerating the OS-level pending
// notifications via `registration.getNotifications({ includeTriggered:
// false })` (not the in-memory `scheduledIds` Set, which doesn't
// survive across sessions) and filtering by the `wc2026-` tag prefix
// so we never touch notifications that belong to other code. Same-tag
// matches in the new plan are NOT explicitly closed; `showNotification`
// with the same tag REPLACES the pending notification per spec, so
// re-arming is idempotent.

import { STAGE_KEYS } from '@/matches/i18n/stage-labels'
import type { Notifier } from '@/notifications/ports/notifier'
import type { ScheduleEntry } from '@/notifications/domain/schedule'
import { useI18n } from '@/shared/i18n/useI18n'

// ─────────────────────────────────────────────────────────────────────
// Type shims for browser-only globals so this module compiles without
// the experimental Notification Triggers TS lib.
// ─────────────────────────────────────────────────────────────────────

interface NotificationFilterOptions {
  readonly includeTriggered?: boolean
  readonly tag?: string
}

interface ClosableNotification {
  readonly tag: string
  close(): void
}

interface ServiceWorkerRegistrationLike {
  showNotification(title: string, options: Record<string, unknown>): Promise<void>
  getNotifications(filter?: NotificationFilterOptions): Promise<readonly ClosableNotification[]>
}

type TriggerFactory = (fireAtMs: number) => unknown

// Minimal i18n surface so tests can inject a fake without pulling Vue.
interface I18nLike {
  t(
    key: Parameters<ReturnType<typeof useI18n>['t']>[0],
    params?: Record<string, string | number>,
  ): string
  country(iso: string): string | null
}

export interface ShowTriggerNotifierDeps {
  readonly registrationPromise?: () => Promise<ServiceWorkerRegistrationLike>
  readonly trigger?: TriggerFactory
  readonly i18n?: () => I18nLike
  readonly iconPath?: string
}

function defaultRegistrationPromise(): Promise<ServiceWorkerRegistrationLike> {
  // `navigator.serviceWorker.ready` resolves to the active registration
  // once the SW reaches the "activated" state. In dev with the PWA
  // plugin's `devOptions.enabled`, this resolves; in production it
  // resolves after `vite-plugin-pwa`'s `autoUpdate` flow has installed
  // the worker. We never construct a registration ourselves.
  return navigator.serviceWorker.ready as unknown as Promise<ServiceWorkerRegistrationLike>
}

function defaultTrigger(fireAtMs: number): unknown {
  // `TimestampTrigger` is a Chromium global. We've already gated
  // construction behind `isShowTriggerSupported()` in `pickNotifier`,
  // so this is only invoked in environments where the constructor
  // exists.
  const Ctor = (globalThis as { TimestampTrigger?: new (ts: number) => unknown }).TimestampTrigger
  if (Ctor === undefined) {
    throw new Error('TimestampTrigger missing — pickNotifier should have prevented this code path')
  }
  return new Ctor(fireAtMs)
}

// Honors the Vite `base` config (currently `/wc-schedule/`). Using
// `import.meta.env.BASE_URL` keeps dev + prod aligned and survives future
// base changes.
function defaultIconPath(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  // BASE_URL always ends with a slash per Vite contract; concatenation
  // is safe and avoids URL constructor noise.
  return `${base}pwa-192x192.png`
}

const TAG_PREFIX = 'wc2026-'

// Tag-prefix guard for cross-session cleanup. Every notification we
// arm carries this prefix; the cleanup pass refuses to close any
// notification whose tag doesn't start with it. Defensive — there is
// no other code that calls `registration.showNotification` today, but
// keeping the filter narrow means a future feature can use the same
// SW registration without us yanking its notifications out from
// under it.
const OWN_NOTIFICATION_PREFIX = 'wc2026-'

function taggedId(matchId: string): string {
  return `${TAG_PREFIX}${matchId}`
}

export function createShowTriggerNotifier(deps: ShowTriggerNotifierDeps = {}): Notifier {
  const registrationPromise = deps.registrationPromise ?? defaultRegistrationPromise
  const trigger = deps.trigger ?? defaultTrigger
  const i18nFn = deps.i18n ?? (useI18n as unknown as () => I18nLike)
  const iconPath = deps.iconPath ?? defaultIconPath()

  // Hot-path optimization for `cancel(matchId)`: lets us short-circuit
  // when a caller cancels a tag we never armed in this session. NOT
  // the source of truth for cleanup anymore — that role moved to the
  // OS-level `getNotifications()` enumeration so we can catch orphans
  // from previous sessions (see `getOwnNotifications` + `schedule`).
  const scheduledIds = new Set<string>()

  function renderContent(entry: ScheduleEntry): { title: string; body: string } {
    const { t, country } = i18nFn()
    const { teamA, teamB, stage } = entry.match
    const nameA = country(teamA.iso) ?? teamA.name
    const nameB = country(teamB.iso) ?? teamB.name
    const title = `${nameA} vs ${nameB}`
    const stageLabel = t(STAGE_KEYS[stage])
    const body = `${t('notification.body', { n: 15 })} · ${stageLabel}`
    return { title, body }
  }

  async function getRegistration(): Promise<ServiceWorkerRegistrationLike | null> {
    try {
      return await registrationPromise()
    } catch (error) {
      // SW not available at runtime (rare, but possible in privacy modes
      // that ship Notifications without a SW). Log once per failure;
      // never throw — the composable expects a fire-and-forget schedule.
      console.warn('[show-trigger-notifier] service worker unavailable', error)
      return null
    }
  }

  async function closeByTag(
    registration: ServiceWorkerRegistrationLike,
    tag: string,
  ): Promise<void> {
    // Many Chromium versions accept `{ tag }` as a filter on
    // `getNotifications` and return only matches. Where that filter is
    // ignored, the post-filter below catches the same outcome.
    const all = await registration.getNotifications({ includeTriggered: false, tag })
    for (const n of all) {
      if (n.tag === tag) n.close()
    }
  }

  // Enumerate every OS-level pending notification we own — i.e. those
  // tagged with the `wc2026-` prefix. This is the source of truth for
  // cleanup; `scheduledIds` is only a session-scoped hot cache and
  // wouldn't survive a tab close.
  //
  // We try `{ includeTriggered: false }` first because the Notification
  // Triggers spec defines that filter and Chromium respects it. Some
  // older / non-Chromium implementations are documented to throw on
  // unknown option keys; in that case we fall back to the unfiltered
  // call. Either branch yields the same logical result for our use
  // case (we only ever arm trigger-backed notifications) — the
  // `includeTriggered` flag exists mainly to skip already-delivered
  // ones if the OS happens to keep them around.
  async function getOwnNotifications(
    registration: ServiceWorkerRegistrationLike,
  ): Promise<readonly ClosableNotification[]> {
    let all: readonly ClosableNotification[]
    try {
      all = await registration.getNotifications({ includeTriggered: false })
    } catch {
      all = await registration.getNotifications()
    }
    return all.filter((n) => typeof n.tag === 'string' && n.tag.startsWith(OWN_NOTIFICATION_PREFIX))
  }

  async function cancel(matchId: string): Promise<void> {
    const tag = taggedId(matchId)
    const registration = await getRegistration()
    if (registration === null) {
      scheduledIds.delete(tag)
      return
    }
    try {
      await closeByTag(registration, tag)
    } catch (error) {
      console.warn('[show-trigger-notifier] cancel failed', { matchId, error })
    }
    scheduledIds.delete(tag)
  }

  async function cancelAll(): Promise<void> {
    const registration = await getRegistration()
    if (registration === null) {
      scheduledIds.clear()
      return
    }
    let pending: readonly ClosableNotification[]
    try {
      pending = await getOwnNotifications(registration)
    } catch (error) {
      // If we can't enumerate, we can't safely close — log and clear
      // the in-memory cache so callers don't see stale ids. Production
      // never relies on this branch for correctness; it's a belt for
      // pathological SW implementations.
      console.warn('[show-trigger-notifier] cancelAll: enumeration failed', { error })
      scheduledIds.clear()
      return
    }
    for (const n of pending) {
      try {
        n.close()
      } catch (error) {
        console.warn('[show-trigger-notifier] cancelAll: per-tag close failed', {
          tag: n.tag,
          error,
        })
      }
    }
    scheduledIds.clear()
  }

  async function schedule(entries: readonly ScheduleEntry[]): Promise<void> {
    const registration = await getRegistration()
    if (registration === null) return

    // Cross-session orphan cleanup: enumerate every prior `wc2026-*`
    // notification the OS is holding and close the ones whose tag
    // isn't in the new plan. Same-tag entries are intentionally left
    // alone — `showNotification` with the same tag REPLACES the
    // pending one per spec, so re-arming below is idempotent and a
    // pre-close would race with the re-arm.
    const planTags = new Set(entries.map((e) => taggedId(e.matchId)))
    try {
      const existing = await getOwnNotifications(registration)
      for (const n of existing) {
        if (!planTags.has(n.tag)) {
          try {
            n.close()
          } catch (error) {
            console.warn('[show-trigger-notifier] schedule: orphan close failed', {
              tag: n.tag,
              error,
            })
          }
        }
      }
    } catch (error) {
      // Enumeration failure is non-fatal — we still try to arm the new
      // plan. The next `schedule()` call will retry the cleanup.
      console.warn('[show-trigger-notifier] schedule: orphan enumeration failed', { error })
    }

    // Reset the in-memory cache to mirror the new plan; we repopulate
    // as each entry arms successfully so a failing entry isn't tracked
    // as scheduled.
    scheduledIds.clear()

    for (const entry of entries) {
      const tag = taggedId(entry.matchId)
      try {
        const { title, body } = renderContent(entry)
        await registration.showNotification(title, {
          body,
          tag,
          icon: iconPath,
          silent: false,
          showTrigger: trigger(entry.fireAtMs),
        })
        scheduledIds.add(tag)
      } catch (error) {
        // Per-entry isolation: one bad entry (e.g. malformed kickoff
        // sneaking past the planner, or a TimestampTrigger throw on a
        // Chromium that decided to deprecate it mid-session) MUST NOT
        // kill the rest of the batch.
        console.warn('[show-trigger-notifier] failed to arm entry', {
          matchId: entry.matchId,
          error,
        })
      }
    }
  }

  // The port's `schedule` / `cancel` / `cancelAll` are declared as
  // `void`-returning; we return promises directly because TypeScript's
  // `() => void` is structurally satisfied by `() => Promise<void>` and
  // tests can `await` to flush the SW interactions deterministically.
  // Production callers (`useNotifications`) ignore the return value —
  // it's true fire-and-forget at the composition layer.
  return {
    name: 'show-trigger',
    schedule,
    cancel,
    cancelAll,
  }
}
