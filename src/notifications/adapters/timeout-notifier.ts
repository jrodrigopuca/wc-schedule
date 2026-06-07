// Foreground notifier (Phase 9a). One `setTimeout` per upcoming match;
// fires the platform `Notification` constructor when the timer elapses.
// Dies when the tab dies — that's the whole point of being "foreground
// only". Background coverage (showTrigger, SW queue) lands in Phase 9b
// via additional adapters behind `pickNotifier()`.
//
// Design properties:
//   - Atomic replace: `schedule()` cancels prior timers before arming.
//   - Locale at FIRE time: the renderer reads `useI18n()` synchronously
//     inside the `fire` callback, so a user changing locale after
//     scheduling sees the next notification in the new language without
//     a re-plan.
//   - Defensive on `Notification` absence: if the global is missing
//     (test env, unsupported browser, iOS Safari < 16.4) the adapter is
//     a silent no-op. The composable also checks permission; this is
//     a belt-and-suspenders.
//   - Dependency injection: production wires to real globals; tests
//     pass a fake clock + a spy constructor without touching the real
//     `window`.

import { STAGE_KEYS } from '@/matches/i18n/stage-labels'
import type { Notifier } from '@/notifications/ports/notifier'
import type { ScheduleEntry } from '@/notifications/domain/schedule'
import { useI18n } from '@/shared/i18n/useI18n'
import { getNow } from '@/shared/time/now'

// We treat `Notification` opaquely — the adapter never reads from the
// instance, it just constructs one. Modeling it as `new (...) => unknown`
// makes the seam clean and the `vi.stubGlobal` story trivial.
type NotificationCtor = new (title: string, options?: NotificationOptions) => unknown

export interface TimeoutNotifierDeps {
  readonly now?: () => number
  readonly setTimeout?: (handler: () => void, ms: number) => number
  readonly clearTimeout?: (handle: number) => void
  readonly notify?: NotificationCtor
}

// Tunable for adapter-level diagnostics. Keep in sync with the manifest
// asset name in vite.config.ts (PWA icons under `/wc-schedule/`).
const ICON_PATH = '/wc-schedule/pwa-192x192.png'

export function createTimeoutNotifier(deps: TimeoutNotifierDeps = {}): Notifier {
  // Resolve dependencies. We capture them at construction time, not on
  // every call, so a test that stubs `window.Notification` AFTER the
  // notifier was built will still see the original ref. Production wires
  // to the live globals at boot via `pickNotifier()`.
  const nowFn = deps.now ?? getNow
  const setTimeoutFn = deps.setTimeout ?? globalSetTimeout
  const clearTimeoutFn = deps.clearTimeout ?? globalClearTimeout

  // `matchId → timer handle`. Map (not Record) so iteration order and
  // `.size` are predictable, and so cancel-by-id is O(1).
  const timers = new Map<string, number>()

  function resolveNotificationCtor(): NotificationCtor | null {
    if (deps.notify !== undefined) return deps.notify
    if (typeof globalThis === 'undefined') return null
    const candidate = (globalThis as { Notification?: NotificationCtor }).Notification
    return candidate ?? null
  }

  function fire(entry: ScheduleEntry): void {
    timers.delete(entry.matchId)
    const Ctor = resolveNotificationCtor()
    // Defensive: the constructor may have disappeared between schedule
    // and fire (rare, but a user disabling notifications via DevTools
    // mid-session could conceivably do this). No throw, no log spam.
    if (Ctor === null) return

    // Read i18n at fire time — locale switches after `schedule()` MUST
    // be honored without a re-plan. `useI18n` is a singleton; this call
    // is cheap.
    const { t, country } = useI18n()
    const { teamA, teamB, stage } = entry.match
    const nameA = country(teamA.iso) ?? teamA.name
    const nameB = country(teamB.iso) ?? teamB.name
    const title = `${nameA} vs ${nameB}`
    const stageLabel = t(STAGE_KEYS[stage])
    const body = `${t('notification.body', { n: 15 })} · ${stageLabel}`

    try {
      new Ctor(title, {
        body,
        // `tag: matchId` — the platform collapses duplicates if the
        // same match somehow gets scheduled twice in flight. Belt-and-
        // suspenders with the adapter's own atomic-replace semantics.
        tag: entry.matchId,
        icon: ICON_PATH,
        silent: false,
      })
    } catch {
      // Some platforms (iOS Safari, certain in-app webviews) throw from
      // the constructor even when `Notification` exists. We swallow —
      // there's no UI we can show from here and the spec accepts
      // platform-level limitations (specs/notifications.md §6.3).
    }
  }

  function cancel(matchId: string): void {
    const handle = timers.get(matchId)
    if (handle === undefined) return
    clearTimeoutFn(handle)
    timers.delete(matchId)
  }

  function cancelAll(): void {
    for (const handle of timers.values()) {
      clearTimeoutFn(handle)
    }
    timers.clear()
  }

  function schedule(entries: readonly ScheduleEntry[]): void {
    // Atomic replace per the port contract.
    cancelAll()
    // If `Notification` is missing, do not bother arming timers — they'd
    // just no-op at fire time and waste memory. Adapter is silent in
    // unsupported environments.
    if (resolveNotificationCtor() === null) return
    const t0 = nowFn()
    for (const entry of entries) {
      const delayMs = entry.fireAtMs - t0
      // `planSchedule` already filters past entries; this is defensive
      // against a re-plan that races a clock tick over the boundary.
      if (delayMs <= 0) continue
      const handle = setTimeoutFn(() => fire(entry), delayMs)
      timers.set(entry.matchId, handle)
    }
  }

  return {
    name: 'timeout',
    schedule,
    cancel,
    cancelAll,
  }
}

// Wrappers around the globals so DI works even when `window` is not
// the same object as `globalThis` (some happy-dom edge cases).
function globalSetTimeout(handler: () => void, ms: number): number {
  return setTimeout(handler, ms) as unknown as number
}

function globalClearTimeout(handle: number): void {
  clearTimeout(handle)
}
