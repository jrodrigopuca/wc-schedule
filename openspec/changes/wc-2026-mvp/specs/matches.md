# Capability Spec — matches

## 1. Purpose

Describe the behavior of the "matches of the day" capability: how the
app exposes the set of matches a user cares about at any given moment,
how that set is ordered and grouped, and what a single match means as a
stateful entity.

This spec defines BEHAVIOR only. Selection, transitions and visual
emphasis for the highlighted match are owned by `featured.md`. Data
provenance and freshness are owned by `data-source.md`.

## 2. Definitions

- **Match**: a scheduled fixture of the FIFA World Cup 2026 with a
  unique identifier, two participating teams, a kickoff instant
  expressed in UTC, a competition stage, and a state (see §5).
- **Today**: the calendar day in the user's local timezone, derived
  from the device's reported timezone. The window for "today" starts
  at local 00:00:00 (inclusive) and ends at local 24:00:00 (exclusive).
- **Kickoff instant**: the canonical UTC timestamp of when the match
  is scheduled to begin.
- **Local kickoff time**: the kickoff instant rendered in the user's
  local timezone for display purposes only.

## 3. "Today" — rules from the user's perspective

- The boundary of "today" MUST be computed from the device's local
  timezone, not from a hardcoded region.
- A match belongs to "today" if and only if its kickoff instant, when
  projected into the user's local timezone, falls inside the local
  day window defined in §2.
- The "today" window MUST be re-evaluated when the app regains
  visibility (tab refocus, return from background) so a user crossing
  midnight while the app is open sees the correct day.
- A match that started before local midnight but is still in
  progress after local midnight MUST be considered as belonging to
  the day of its kickoff, NOT to the new day.
- Devices with a half-hour or quarter-hour timezone offset MUST be
  handled correctly; no assumption of whole-hour offsets is allowed.

## 4. List ordering and grouping

- The list of today's matches MUST be sorted by kickoff instant
  ascending (earliest first).
- When two matches share the same kickoff instant, the secondary sort
  key is the match identifier in ascending lexicographic order
  (purely to guarantee stable ordering).
- The list MAY be grouped visually by time-of-day buckets (e.g.
  morning / afternoon / evening); grouping is presentational and
  MUST NOT alter the sort defined above.
- The list MUST NOT include matches from other days, except as
  described in §6 (empty-day fallback).

## 5. Match states

A single match MUST be in exactly one of the following states at any
moment:

- **scheduled** — kickoff instant is in the future; the match is
  expected to start as planned.
- **live** — the current instant is at or after kickoff and before
  the end of the live window defined for the match (see
  `featured.md` for the live-window rule used by the featured slot;
  the same window definition applies here).
- **finished** — the live window has elapsed and the match is
  considered concluded.
- **postponed** — the match's kickoff instant has been moved to a
  later, possibly unknown, time. A postponed match MUST NOT count as
  "today" until and unless its new kickoff lands inside the local
  day window.
- **cancelled** — the match will not be played. A cancelled match
  MUST NOT appear in the list of today's matches.

State is derived; it is not user-editable. State transitions are
driven by time and by the data source. When the data source reports
a state that conflicts with a time-derived state (e.g. a match marked
`scheduled` in data but whose kickoff was 3 hours ago), the data
source's state MUST win; time-derived state is only a fallback when
no explicit state is provided.

### 5.1 Score rendering rules in the list

The list of today's matches MUST follow these rules for any score
field carried in the underlying data:

- For a match whose resolved state is `live`, the list row MUST
  render the localized "live" badge (see `i18n.md` for the
  `match.badge.live` key) and MUST NOT render a score, even if the
  payload carries one from a prior snapshot. The daily-refresh
  pipeline cannot honestly report in-flight scores; surfacing one
  would mislead the user about its freshness.
- For a match whose resolved state is `finished`, the list row MUST
  render the final score when the payload carries one. The score
  appears in the list (not in the featured slot) because the daily
  refresh CAN backfill finished-match scores once the match has
  concluded — those numbers are by-then authoritative, not in-flight.
- For `scheduled`, `postponed`, or any state where a score is not
  semantically meaningful, the list row MUST NOT render a score
  block.

## 6. Zero-match-today behavior

When the application's list of matches contains no entries for the
local "today":

- The list surface MUST clearly communicate that there are no matches
  today (no empty grid, no spinner, no error).
- The application MUST still present the user with the next
  upcoming match on any future day, surfaced through the featured
  slot (see `featured.md` §state `upcoming-future`).
- If there are also no future matches at all, the surface MUST
  reflect the tournament-over state (see `featured.md` §state
  `tournament-over`).

## 7. Cross-references

- Highlight / countdown / live indicator → `featured.md`
- Pre-match reminders → `notifications.md`
- Where match data comes from and how stale it may be → `data-source.md`
- Install / offline behavior → `pwa.md`
- Localization of state badges, stage labels, list title/count/empty
  copy, and CTA labels → `i18n.md`

## 8. Acceptance criteria (Given/When/Then)

### AC-1: Local-day boundary

- **Given** the user's device is in timezone UTC-03:00
- **And** a match has kickoff instant `2026-06-12T02:30:00Z`
- **When** the user opens the app at local time `2026-06-11 23:45`
- **Then** the match MUST appear in today's list (local day is
  2026-06-11, kickoff projects to 23:30 local)

### AC-2: Half-hour offset

- **Given** the user's device is in a timezone with a 30-minute offset
  (e.g. UTC+05:30)
- **When** the app determines the "today" window
- **Then** the start and end of "today" MUST respect the 30-minute
  offset exactly, with no rounding to the nearest hour

### AC-3: Sort order

- **Given** today contains three matches at kickoff instants T1 < T2 = T3
- **When** the list renders
- **Then** the order MUST be T1, then T2, then T3, with T2/T3 broken
  by ascending match identifier

### AC-4: Crossing midnight while open

- **Given** the app is open at local 23:58 with today's list shown
- **When** local time advances past 00:00 and the user refocuses the tab
- **Then** the list MUST re-evaluate and reflect the new local day

### AC-5: Late-running match

- **Given** a match started at local 22:30 and is still live at local 00:15
- **When** the list re-evaluates after midnight
- **Then** that match MUST remain attributed to the previous day and
  MUST NOT be duplicated into the new day's list

### AC-6: Cancelled match

- **Given** a match scheduled for today is reported as `cancelled`
- **When** the list renders
- **Then** that match MUST NOT appear in today's list

### AC-7: Postponed match

- **Given** a match originally scheduled for today is reported as
  `postponed` with a new kickoff outside the local day window
- **When** the list renders
- **Then** that match MUST NOT appear in today's list

### AC-8: Empty day

- **Given** the local "today" contains zero matches
- **When** the user opens the app
- **Then** the list surface MUST communicate "no matches today"
- **And** the featured slot MUST surface the next upcoming match per
  `featured.md`

### AC-9: Derived state when data is silent

- **Given** the data source provides no explicit state for a match
- **And** the kickoff instant is 30 minutes in the past
- **When** the app classifies the match
- **Then** the match MUST be classified as `live`

### AC-10: Data state overrides derived state

- **Given** the data source reports a match as `scheduled`
- **And** the kickoff instant is 3 hours in the past
- **When** the app classifies the match
- **Then** the data source's `scheduled` state MUST be used (the
  source is authoritative for explicit state); UI MAY surface the
  inconsistency but MUST NOT silently reclassify

### AC-11: Live row hides score

- **Given** a match in today's list resolves to state `live`
- **And** the underlying payload carries a `score` field (e.g.
  `{ home: 1, away: 0 }` from a prior daily snapshot)
- **When** the list row renders
- **Then** the row MUST display the localized "live" badge (see
  `i18n.md` key `match.badge.live`)
- **And** the row MUST NOT render the score in any visible or
  assistive-tech-accessible form

### AC-12: Finished row shows score

- **Given** a match in today's list resolves to state `finished`
- **And** the underlying payload carries a `score` field with the
  final result
- **When** the list row renders
- **Then** the row MUST render the localized "final" badge (key
  `match.badge.finished`) AND the score

### AC-13: Scheduled row has no score block

- **Given** a match in today's list resolves to state `scheduled`
- **When** the list row renders
- **Then** the row MUST NOT render any score block (no zero-zero
  placeholder, no dash)
