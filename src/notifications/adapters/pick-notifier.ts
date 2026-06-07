// Notifier selection seam. Phase 9b LOCKS production on a single strategy:
// `Notification.showTrigger` (Chromium). When the platform lacks
// showTrigger we return `null` — `useNotifications` interprets that as
// `'unsupported'` and the CTA renders nothing (see design.md §8 / §12.2).
//
// Why no fallback? `setTimeout` only works while the tab is foregrounded,
// which produces silent misses for the exact scenario the feature exists
// for ("remind me 15 min before kickoff while I'm doing something else").
// We'd rather show nothing than ship a feature that lies. The
// `timeout-notifier` module stays in the repo as documentation + a unit-
// test seam against the composable; production NEVER wires it.
//
// Detection probes the canonical surface:
//   - `'Notification' in window`             → Web Notifications API present
//   - `'showTrigger' in Notification.prototype` → schedule-by-OS surface
//   - `'serviceWorker' in window.navigator`  → required to obtain the
//     registration that owns the pending notification
//   - `typeof TimestampTrigger !== 'undefined'` → constructor for the
//     `showTrigger` value; if Chromium ever removes this we degrade
//     gracefully to "no CTA".

// NOTE: `timeout-notifier` import is intentionally NOT live in production
// — we keep the module compiled and reachable via direct import in tests
// so the composable's contract stays exercised. See top-of-file note.
import { createShowTriggerNotifier } from '@/notifications/adapters/show-trigger-notifier'
import type { Notifier } from '@/notifications/ports/notifier'

export function isShowTriggerSupported(): boolean {
  // SSR / unit-test environments without DOM globals return false up
  // front. The other probes are guarded by short-circuit evaluation so
  // the chain is safe even on `Notification === undefined`.
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  // `Notification.prototype` is the canonical probe per the spec; an
  // `'showTrigger' in window.Notification` (on the constructor) is NOT
  // the same surface and will silently miss.
  const NotificationCtor = window.Notification as unknown as { prototype?: object } | undefined
  if (!NotificationCtor?.prototype) return false
  if (!('showTrigger' in NotificationCtor.prototype)) return false
  if (!('serviceWorker' in window.navigator)) return false
  // `TimestampTrigger` is a global in Chromium when the feature ships.
  // We feature-test the constructor itself rather than its existence on
  // `window`, because some test harnesses (happy-dom) iframe-strip
  // window-only props.
  if (typeof (globalThis as { TimestampTrigger?: unknown }).TimestampTrigger === 'undefined') {
    return false
  }
  return true
}

export function pickNotifier(): Notifier | null {
  if (!isShowTriggerSupported()) return null
  return createShowTriggerNotifier()
}
