// Notifier port — the hexagonal seam between the planner (pure) and
// whatever strategy actually arms timers + renders notifications.
//
// Three strategies, one shape (design.md §8):
//   - 'timeout'      — foreground only, `setTimeout` per entry (Phase 9a).
//   - 'show-trigger' — Chromium `Notification.showTrigger` (Phase 9b).
//   - 'sw'           — service-worker queue (Phase 9b).
//
// `name` is for diagnostics ONLY — never a behavioral switch. Callers
// must treat every Notifier as opaque.
//
// `schedule(entries)` is an ATOMIC REPLACE: the implementation cancels
// any in-flight schedule and arms the new set in one call. Reason:
// re-planning is the natural flow (boot, visibility-regain, data
// refresh); partial diff strategies invite bugs around dedupe and
// fire-time changes. The `tag: matchId` on the platform side already
// handles dedupe at the OS level — the port layer doesn't need to
// reinvent it.

import type { ScheduleEntry } from '@/notifications/domain/schedule'

export interface Notifier {
  readonly name: string
  schedule(entries: readonly ScheduleEntry[]): void
  cancel(matchId: string): void
  cancelAll(): void
}
