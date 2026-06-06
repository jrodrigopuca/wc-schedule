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

export type NotificationPermissionState =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'

const permission = ref<NotificationPermissionState>(readInitialState())

function readInitialState(): NotificationPermissionState {
  // `window` guard for SSR + the absence-of-API check. `'Notification' in
  // window` is the canonical Web-platform feature test; iOS Safari < 16.4
  // famously lacks it.
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
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

export interface UseNotificationsReturn {
  readonly permission: Readonly<Ref<NotificationPermissionState>>
  requestPermission(): Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  return {
    permission: readonly(permission),
    requestPermission,
  }
}

// Test-only helper: reset the singleton state by re-reading the current
// environment. Mirrors `__resetMatchesForTests`. Tests MUST call this after
// stubbing `window` / `Notification` so the next `useNotifications()` call
// reflects the new stub.
export function __resetNotificationsForTests(): void {
  permission.value = readInitialState()
}
