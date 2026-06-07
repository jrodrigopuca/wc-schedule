// `useNotifications` — minimal permission-lifecycle composable. This is the
// foundation B-2a needs to render the EnableNotificationsButton in B-2b.
// Actual scheduling of pre-match notifications lands in Phase 9.
//
// State machine (per specs/notifications.md §3):
//
//   unsupported ──── browser has no Notification global ────► terminal
//
//   idle ─── requestPermission() ───► requesting ──┬─► granted (terminal*)
//                                                  └─► denied  (terminal*)
//
//   *Terminal for THIS session: browsers permanently deny after a user
//   dismisses twice, and we MUST NOT re-prompt after either outcome
//   (specs/notifications.md §3 + AC-3). The user can flip the permission
//   back via browser settings; visibility-regain re-reads are a Phase 9
//   concern and are NOT modeled here.
//
// `requestPermission()` is idempotent for every state except `'idle'`:
// - `'unsupported'`: no-op (no `Notification` constructor to call).
// - `'requesting'`: no-op (avoids overlapping prompts).
// - `'granted'` / `'denied'`: no-op (don't re-prompt, period).
//
// Singleton lifecycle: state is module-scoped and mirrors the pattern in
// `useTheme.ts` / `useI18n.ts` — one `Notification.permission` read at module
// load, every `useNotifications()` call returns refs that point at the same
// state.

import { readonly, ref, type Ref } from 'vue'
import { isShowTriggerSupported, pickNotifier } from '@/notifications/adapters/pick-notifier'
import type { ScheduleEntry } from '@/notifications/domain/schedule'
import type { Notifier } from '@/notifications/ports/notifier'

export type NotificationPermissionState =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'

const permission = ref<NotificationPermissionState>(readInitialState())

// Lazy notifier. We don't build it eagerly because (a) the picker probes
// `Notification.prototype` features (Phase 9b) and we want that probe to
// happen with the live runtime, and (b) tests can rebuild between cases
// via `__resetNotifierForTests`. The composable is the single owner of
// this instance — MainView NEVER touches it directly.
let notifier: Notifier | null = null

function readInitialState(): NotificationPermissionState {
  // `window` guard for SSR + the absence-of-API check. `'Notification' in
  // window` is the canonical Web-platform feature test; iOS Safari < 16.4
  // famously lacks it.
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  // Phase 9b: production only ships a strategy we can deliver reliably
  // (showTrigger). When it's missing we treat the entire feature as
  // `'unsupported'` so the CTA never appears (design.md §12.2 — no
  // half-broken fallback). We intentionally do NOT mirror native
  // permission in that case; even if the user previously granted via
  // another origin/feature, we have no delivery path we trust.
  if (!isShowTriggerSupported()) return 'unsupported'
  return mapNativePermission(window.Notification.permission)
}

function mapNativePermission(value: NotificationPermission): NotificationPermissionState {
  // `'default'` is the browser-spec name for "the user hasn't decided yet".
  // We rename it `'idle'` so the state union reads cleanly at call sites
  // (no need to disambiguate the word "default" against CSS / TypeScript).
  if (value === 'granted') return 'granted'
  if (value === 'denied') return 'denied'
  return 'idle'
}

async function requestPermission(): Promise<void> {
  // Hard guard: only `'idle'` is a valid entry point. Every other state is
  // a deliberate no-op per the rules at the top of this file.
  if (permission.value !== 'idle') return
  // Defensive — `readInitialState` should have already pinned us to
  // `'unsupported'` if the API is missing, but a future refactor that adds
  // re-reads on visibility-change might land us in `'idle'` even after the
  // window lost the constructor. Cheap to check.
  if (typeof window === 'undefined' || !('Notification' in window)) {
    permission.value = 'unsupported'
    return
  }
  permission.value = 'requesting'
  try {
    const outcome = await window.Notification.requestPermission()
    permission.value = mapNativePermission(outcome)
  } catch {
    // Per spec a thrown `requestPermission` is treated like a denial — we
    // never want to leave the state stuck on `'requesting'`. The user can
    // re-enable from browser settings; we don't re-prompt.
    permission.value = 'denied'
  }
}

function schedule(entries: readonly ScheduleEntry[]): void {
  // Per specs/notifications.md §3 + AC-1/AC-3: never act on permission
  // states other than 'granted'. The composable is the single guard
  // for this — adapters trust they were called appropriately.
  if (permission.value !== 'granted') return
  // Phase 9b: the picker may legitimately return `null` in degraded
  // environments. We never reach this branch in production (the CTA
  // can't unlock `'granted'` if `readInitialState` returned
  // `'unsupported'`), but the guard keeps the lazy slot honest in
  // tests that prime permission directly.
  notifier ??= pickNotifier()
  notifier?.schedule(entries)
}

function cancelAllScheduled(): void {
  // Idempotent — safe to call when no notifier was ever constructed
  // (e.g. permission flipped from idle straight to denied externally,
  // or the platform never wired one because showTrigger is missing).
  notifier?.cancelAll()
}

export interface UseNotificationsReturn {
  readonly permission: Readonly<Ref<NotificationPermissionState>>
  requestPermission(): Promise<void>
  schedule(entries: readonly ScheduleEntry[]): void
  cancelAllScheduled(): void
}

export function useNotifications(): UseNotificationsReturn {
  return {
    permission: readonly(permission),
    requestPermission,
    schedule,
    cancelAllScheduled,
  }
}

// Test-only helper: reset the singleton state by re-reading the current
// environment. Mirrors `__resetMatchesForTests`. Tests MUST call this after
// stubbing `window` / `Notification` so the next `useNotifications()` call
// reflects the new stub.
export function __resetNotificationsForTests(): void {
  permission.value = readInitialState()
}

// Test-only helper: drop the lazy notifier so the next `schedule()`
// rebuilds it. Pair with the permission reset above when a test wants a
// fully clean composable singleton.
export function __resetNotifierForTests(): void {
  notifier = null
}
