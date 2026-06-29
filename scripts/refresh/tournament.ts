// FIFA World Cup 2026 official window — the SINGLE source of truth for the
// refresh pipeline's tournament anchors (design.md §10.1, data-source.md §6.4).
//
// These constants are the ONLY place the tournament boundaries live. The
// client never sees them — they exist purely to make the cron
// tournament-aware (full refresh / throttled refresh / no-op). If FIFA
// reschedules, update HERE and nowhere else.
//
// All values are bare UTC calendar dates (YYYY-MM-DD). Date arithmetic in
// `window.ts` is UTC-date-only to avoid DST / host-timezone surprises on
// the CI runner.

export const TOURNAMENT_START_UTC = '2026-06-11' // opening match, UTC date
export const TOURNAMENT_END_UTC = '2026-07-19' // final, UTC date

export const NEAR_LEAD_DAYS = 30 // lead-in before kickoff (data-source.md §6.2)
export const NEAR_TAIL_DAYS = 7 // tail-off after the final (data-source.md §6.2)

// "tournament" → refresh every cron run (~4h); "near" → every 48h; "off" → no-op.
export type RefreshMode = 'tournament' | 'near' | 'off'
