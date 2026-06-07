// Tournament-day enumeration. Pure domain function: given a wall-clock
// instant `now`, enumerate the 39 days of the World Cup 2026 window
// (June 11 → July 19, 2026) in the host's LOCAL zone.
//
// Each day spans `[localStart, localStart + 24h)` per design.md §11. We
// step day-by-day via `new Date(y, m, d + i)` (host zone), so DST
// transitions inside the window collapse to the 23h/25h compromise also
// described in `today.ts`. World Cup 2026 (Jun 11 – Jul 19) does not
// straddle a DST boundary in CA/MX/US target zones, so this is a
// non-event in practice — the test bounds it anyway.

const DAY_MS = 86_400_000

export const TOURNAMENT_START_YMD = '2026-06-11'
export const TOURNAMENT_END_YMD = '2026-07-19'

export interface TournamentDay {
  readonly number: number
  readonly dateYMD: string
  readonly utcStartMs: number
  readonly utcEndMs: number
}

function parseYMD(ymd: string): { year: number; month: number; day: number } {
  // Caller is internal; the constants above are well-formed.
  const [yearStr, monthStr, dayStr] = ymd.split('-')
  return {
    year: Number(yearStr),
    month: Number(monthStr) - 1,
    day: Number(dayStr),
  }
}

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysBetween(startMs: number, endMs: number): number {
  // Inclusive count of local days from `startMs` to `endMs`. Rounding
  // absorbs the 23h/25h DST compromise so the count stays an integer.
  return Math.round((endMs - startMs) / DAY_MS) + 1
}

export function enumerateTournamentDays(_now: number): readonly TournamentDay[] {
  // `_now` is accepted for symmetry with the rest of the time-aware
  // helpers and to make the function signature future-proof (e.g. a
  // hypothetical "current tournament" lookup). The 2026 window itself
  // is a hard-coded constant — the wall clock plays no role in the
  // window's boundaries.
  void _now
  const start = parseYMD(TOURNAMENT_START_YMD)
  const end = parseYMD(TOURNAMENT_END_YMD)
  const startMs = new Date(start.year, start.month, start.day).getTime()
  const endMs = new Date(end.year, end.month, end.day).getTime()
  const totalDays = daysBetween(startMs, endMs)

  const days: TournamentDay[] = []
  for (let i = 0; i < totalDays; i++) {
    // Anchor each day's start via host-zone `new Date(y, m, d + i)` so
    // DST transitions are honored. Avoid the naive `startMs + i*DAY_MS`
    // path which would drift by ±1h across a DST boundary.
    const dayStart = new Date(start.year, start.month, start.day + i)
    const nextDayStart = new Date(start.year, start.month, start.day + i + 1)
    days.push({
      number: i + 1,
      dateYMD: toYMD(dayStart),
      utcStartMs: dayStart.getTime(),
      utcEndMs: nextDayStart.getTime(),
    })
  }
  return days
}

// Resolves the `[start, end)` window for a specific YYYY-MM-DD in the
// host's local zone. Exported for callers that need to filter matches
// without enumerating the full tournament window.
export function dayBoundsForYMD(ymd: string): { utcStartMs: number; utcEndMs: number } {
  const { year, month, day } = parseYMD(ymd)
  const startMs = new Date(year, month, day).getTime()
  const endMs = new Date(year, month, day + 1).getTime()
  return { utcStartMs: startMs, utcEndMs: endMs }
}

// Resolves the host-local YYYY-MM-DD for the given wall-clock ms.
export function ymdForNow(now: number): string {
  const d = new Date(now)
  return toYMD(d)
}
