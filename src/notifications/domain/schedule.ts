// Pure planning function for pre-match notifications. NO side effects:
// no i18n, no clock read, no Notification API. Given a snapshot of
// matches and a `now` epoch, returns the deterministic set of
// `ScheduleEntry` values that an adapter will arm with timers.
//
// Why pure: every layer above (the adapter, the composable, the view)
// can mock the inputs and assert the outputs without touching globals.
// Idempotent — same `(matches, now)` always yields the same array,
// sorted ascending by fire time so replay/diff stays deterministic.
//
// Locale-sensitive content (title, body) is INTENTIONALLY excluded from
// `ScheduleEntry`. The adapter resolves copy at fire time using the
// caller's current `useI18n`, so a locale switch after planning produces
// notifications in the new locale without a re-plan.

import type { Match, Stage } from '@/matches/domain/match'
import { hasUndeterminedTeam } from '@/matches/domain/match'
import { NOTIFICATION_LEAD_MS } from './lead-time'

// Subset of `Match` carried into the fire-time renderer. Exposed as a
// named type so adapters can build their own renderers against a stable
// contract — and so a future change to `Match` doesn't silently widen
// what notifications can show (score, venue, etc. are deliberately NOT
// part of the contract per specs/notifications.md §5).
export interface ScheduleEntryMatchData {
  readonly id: string
  readonly utcKickoff: string
  readonly stage: Stage
  readonly group?: string
  readonly teamA: { readonly iso: string; readonly name: string }
  readonly teamB: { readonly iso: string; readonly name: string }
}

export interface ScheduleEntry {
  readonly matchId: string
  readonly fireAtMs: number
  readonly match: ScheduleEntryMatchData
}

export function planSchedule(matches: readonly Match[], now: number): readonly ScheduleEntry[] {
  const entries: ScheduleEntry[] = []
  for (const m of matches) {
    // Filter rule (specs/notifications.md §2 "eligible match"): only
    // `scheduled` matches qualify. live/finished/postponed/cancelled
    // never trigger pre-match reminders.
    if (m.status !== 'scheduled') continue
    // Skip undetermined knockout slots: there is no real opponent to remind
    // about yet, and the notification body would read "Por definir vs Por
    // definir". A later refresh re-plans once the draw fills in.
    if (hasUndeterminedTeam(m)) continue
    const fireAtMs = Date.parse(m.utcKickoff) - NOTIFICATION_LEAD_MS
    // Drop entries whose fire time is already in the past (or exactly
    // `now`). AC-5: no retroactive notification when boot happens
    // within the 15-minute lead window. `<=` excludes the "fire at the
    // exact moment we plan" edge — arming a 0ms timer is racy and we'd
    // rather skip than risk a duplicate at the boundary.
    if (fireAtMs <= now) continue
    entries.push({
      matchId: m.id,
      fireAtMs,
      match: buildMatchData(m),
    })
  }
  // Ascending by fire time keeps tests stable, makes the diagnostic
  // story obvious ("next fire is X"), and lets future adapters (SW
  // queue, showTrigger fallback) reason about a single sorted list.
  entries.sort((a, b) => a.fireAtMs - b.fireAtMs)
  return entries
}

function buildMatchData(m: Match): ScheduleEntryMatchData {
  // We rebuild instead of passing `m` through because `Match` carries
  // score/venue fields that the notification MUST NOT include
  // (specs/notifications.md §5). An explicit projection makes that
  // contract enforceable at the type level.
  const base = {
    id: m.id,
    utcKickoff: m.utcKickoff,
    stage: m.stage,
    teamA: { iso: m.teamA.iso, name: m.teamA.name },
    teamB: { iso: m.teamB.iso, name: m.teamB.name },
  } as const
  // `exactOptionalPropertyTypes` forbids assigning `undefined` to an
  // optional property; only spread `group` when it's actually present.
  return m.group !== undefined ? { ...base, group: m.group } : base
}
