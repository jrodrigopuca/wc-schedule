# Capability Spec — featured

## 1. Purpose

Describe the behavior of the featured slot at the top of the app: a
single, adaptive surface that, at any moment, answers the user's two
core questions — "is there a match right now?" and "when is the next
one?".

This spec defines BEHAVIOR only. The pool of matches and the
definition of "today" are owned by `matches.md`.

## 2. The five states

The featured slot MUST be in exactly one of the following states at
any moment:

- **live-single** — exactly one match is currently in its live window.
  The slot communicates that the match is in progress via a TEXTUAL
  in-progress indicator (see `i18n.md` for the localized string), the
  eyebrow label, and the derby tableau. The slot MUST NOT render a
  score — the daily-refresh pipeline cannot honestly report in-flight
  scores; see `data-source.md` §freshness.
- **live-multiple** — two or more matches are simultaneously in their
  live windows.
- **upcoming-today** — no matches are live; at least one match
  scheduled for today (per `matches.md` §3) has not yet kicked off.
- **upcoming-future** — no matches are live; no matches remain today;
  at least one match exists on a future calendar day.
- **tournament-over** — no matches are live; no matches remain today;
  no future matches exist in the dataset.

These states MUST be mutually exclusive and collectively exhaustive.

## 3. Live window

- A match is "live" from its kickoff instant (inclusive) until
  kickoff + 110 minutes (exclusive). This window accounts for two
  45-minute halves, a 15-minute interval, and ~5 minutes of stoppage
  buffer.
- A match in extra time or penalties MAY exceed the live window;
  this is acceptable for MVP. The window is a deterministic, purely
  time-based heuristic; no live API is consulted.
- A match reported by the data source as `finished` MUST be treated
  as finished regardless of the time window.
- A match reported as `cancelled` or `postponed` MUST NOT be live.

## 4. Selection rules

### 4.1 live-single

- **Selected match**: the single match currently in its live window.
- **Display contract**: the slot MUST show team identifiers, the
  competition stage, the local kickoff time, a clear "live" eyebrow
  label, and a TEXTUAL in-progress indicator (see `i18n.md` for the
  exact localized string). The slot MUST NOT display a score: the
  daily-refresh pipeline cannot honestly source in-flight scores
  (see `data-source.md` §freshness). If the underlying match payload
  happens to carry a `score` field from a prior snapshot, the
  renderer MUST ignore it for the duration of the live window.

### 4.2 live-multiple

- **Selected match**: NONE. The slot surfaces an aggregate summary
  ("hay N partidos en vivo") instead of any individual match.
- **Display contract**: the slot MUST show the count of live matches
  and a brief indication that the list below is the primary surface.
- The slot MUST NOT silently pick one of the live matches as the
  "winner" — that would mislead the user.
- Cycling through the live matches inside the slot is OUT OF SCOPE
  for MVP (see proposal §9 open questions).

### 4.3 upcoming-today

- **Selected match**: among today's not-yet-started matches, the one
  with the earliest kickoff instant.
- **Tiebreaker**: if two such matches share the same kickoff instant,
  the match with the lower lexicographic identifier wins (consistent
  with `matches.md` §4).
- **Display contract**: the slot MUST show the selected match's team
  identifiers, the competition stage, the local kickoff time, and a
  live countdown to kickoff (see §6).

### 4.4 upcoming-future

- **Selected match**: among all matches on any future calendar day
  (per the user's local timezone), the one with the earliest kickoff
  instant. Tiebreaker as in §4.3.
- **Display contract**: the slot MUST show the selected match's team
  identifiers, the competition stage, the local kickoff date and
  time, and a live countdown (see §6). The countdown MAY exceed
  24 hours and MUST render days when applicable.

### 4.5 tournament-over

- **Selected match**: NONE.
- **Display contract**: the slot MUST present a terminal message
  ("el mundial ha terminado") and MUST NOT show a countdown.

## 5. State transitions

State is derived continuously from the current time and the in-memory
match list. Transitions are not user-driven.

- `upcoming-today` → `live-single` when the selected match's kickoff
  instant is reached and no other match enters its live window in
  the same instant.
- `upcoming-today` → `live-multiple` when reaching kickoff causes
  two or more matches to be simultaneously live.
- `live-single` → `live-multiple` when a second match enters its
  live window before the first one exits.
- `live-multiple` → `live-single` when all but one live match exit
  their live windows.
- `live-single` / `live-multiple` → `upcoming-today` when the last
  live match exits its live window AND at least one match remains
  scheduled for today.
- `live-single` / `live-multiple` / `upcoming-today` → `upcoming-future`
  when no live matches remain AND no matches remain scheduled for
  today AND at least one future match exists.
- `upcoming-future` → `tournament-over` when no future matches
  remain in the dataset.
- Any state → re-evaluated when the underlying match list is
  replaced (e.g. after a data refresh per `data-source.md`).

State MUST be re-evaluated at minimum on:

- App boot.
- Tab visibility regain.
- Every countdown tick (see §6) for time-driven transitions.
- Replacement of the in-memory match list.

## 6. Countdown behavior

Applies to states `upcoming-today` and `upcoming-future`.

- **Precision**: the countdown MUST render with one-second
  granularity (HH:MM:SS, with leading days when the target is more
  than 24 hours away).
- **Update cadence**: the displayed value MUST update at least once
  per second. Implementations MAY align updates to the wall clock
  to avoid drift; this is non-normative.
- **At zero**: when the countdown reaches zero, the slot MUST
  transition out of the upcoming state per §5 within the same tick.
  The slot MUST NOT display a negative countdown.
- **Clock drift**: countdown computation MUST be based on the
  difference between the kickoff instant and the device's current
  time, recomputed each tick. It MUST NOT decrement a stored
  in-memory value (which would accumulate drift).
- **Backgrounded tab**: when the tab returns to the foreground, the
  countdown MUST recompute from scratch, not resume from the last
  rendered value.

## 7. Visual presentation contract

This section captures the BEHAVIORAL contract on what the featured
slot must convey — not a CSS specification. Implementation choices
(exact sizes, palettes, animation, image sources) belong in
`design.md`.

### 7.0 In-progress indicator (live-single only)

In `live-single`, the slot MUST present a TEXTUAL in-progress
indicator (the localized string from `i18n.md` keyed by
`featured.live.text`) alongside the eyebrow label and the derby
tableau. The slot MUST NOT display a score, a clock, or any
fabricated minute-mark — none of those values can be sourced honestly
from the daily-refresh pipeline. The text indicator is the sole
piece of "live progression" information the slot exposes.

Typographic treatment of the in-progress text MUST be consistent
with other featured-slot primary content (same family and weight
class as the country names / countdown), so users perceive it as
informational rather than as a banner or alert.

### 7.1 Team identity in two-team states

States `live-single`, `upcoming-today`, and `upcoming-future` show
exactly two participating teams. In these states:

- Each team's identity MUST be visually prominent — not reduced to
  a small icon or a single line of text.
- Each team MUST be represented by a circular flag medallion of
  generous size relative to the slot. The two medallions are the
  visual anchors of the slot.
- The country name MUST appear adjacent to its medallion, rendered
  in uppercase, with weight and size that read as primary content,
  not as a caption.
- The composition MUST feel symmetric (two opposing identities of
  equal weight), evoking a derby/clash rather than a generic
  schedule entry.

### 7.2 Background halo from team colors

In the two-team states (§7.1):

- The featured slot's background MUST carry a soft tint derived
  from each team's primary color, positioned so that each team's
  hue is associated with its side of the composition.
- The tint MUST be SUBTLE — it MUST NOT compromise the contrast of
  body text, the live indicator, or the countdown (see also
  `theming.md` §6).
- The tint MUST adapt to the active theme so the halo reads as a
  soft hint in both light and dark modes.

### 7.3 live-multiple and tournament-over

- In `live-multiple`, no individual teams are highlighted (per
  §4.2). The slot MUST NOT render the two-team derby tableau.
- In `live-multiple` the slot MUST still feel like the same surface
  as the two-team states (same dimensions, same anchoring of the
  live indicator, same theming) so users do not perceive a layout
  break when state transitions occur.
- In `tournament-over` the slot MUST present its terminal message
  with the same surface identity but without medallions, country
  names, or a halo.

### 7.4 Mini-medallions in the matches list

- Outside the featured slot, in the list of today's matches, each
  team MUST be accompanied by a mini circular flag medallion
  rendered next to its name.
- The mini medallions MUST be visually consistent with the
  featured medallions (same shape, same border treatment, scaled
  down). The list is a smaller, denser surface — medallions there
  are identifiers, not focal points.

## 8. Cross-references

- Pool of candidate matches and "today" definition → `matches.md`
- Pre-match reminders are independent of featured-slot state →
  `notifications.md`
- Data freshness expectations that constrain score display →
  `data-source.md`
- Theme behavior and contrast guarantees that constrain the halo
  tint → `theming.md`
- Localization of the eyebrow label, in-progress text, stage names,
  and CTA copy → `i18n.md`

## 9. Acceptance criteria (Given/When/Then)

### AC-1: live-single

- **Given** exactly one match has been in its live window for 20 minutes
- **When** the user opens the app
- **Then** the slot MUST be in `live-single`, showing that match's
  teams, stage, local kickoff time, the live eyebrow label, and the
  localized in-progress text indicator (per `i18n.md`)
- **And** the slot MUST NOT show a score, a match clock, or any
  numeric minute mark

### AC-2: live-multiple

- **Given** two matches are simultaneously inside their live windows
- **When** the user opens the app
- **Then** the slot MUST be in `live-multiple`, showing "hay 2 partidos
  en vivo"
- **And** the slot MUST NOT highlight either match individually

### AC-3: upcoming-today selection

- **Given** today contains three not-yet-started matches with kickoffs
  T1 < T2 < T3 and no live match
- **When** the user opens the app
- **Then** the slot MUST be in `upcoming-today` and MUST select T1

### AC-4: upcoming-today tiebreaker

- **Given** two not-yet-started matches today share the same kickoff
  instant
- **When** the slot selects a candidate
- **Then** the match with the lower lexicographic identifier MUST win

### AC-5: upcoming-future

- **Given** the local "today" contains zero matches
- **And** at least one future-day match exists
- **When** the user opens the app
- **Then** the slot MUST be in `upcoming-future` and MUST select the
  earliest future match

### AC-6: tournament-over

- **Given** no live, today, or future matches exist in the dataset
- **When** the user opens the app
- **Then** the slot MUST be in `tournament-over` and MUST NOT render
  a countdown

### AC-7: kickoff transition

- **Given** the slot is in `upcoming-today` with countdown at 00:00:03
- **When** three seconds elapse
- **Then** the countdown MUST reach zero
- **And** within the same tick the slot MUST transition to `live-single`
  (or `live-multiple` if a simultaneous kickoff applies)

### AC-8: countdown precision

- **Given** the next match kicks off in 2 days, 3 hours, 4 minutes, 5 seconds
- **When** the countdown renders
- **Then** the displayed value MUST include days, hours, minutes and
  seconds, each updated at least once per second

### AC-9: no negative countdown

- **Given** the slot is in `upcoming-today` and the kickoff instant
  passes between two ticks
- **When** the next tick renders
- **Then** the countdown MUST NOT display a negative value; the slot
  MUST have transitioned to a live state

### AC-10: drift after background

- **Given** the slot is in `upcoming-today` and the tab is backgrounded
  for 10 minutes
- **When** the tab is brought to the foreground
- **Then** the countdown MUST reflect the true remaining time within
  one second, not the last value rendered before backgrounding

### AC-11: data refresh re-evaluation

- **Given** the slot is in `upcoming-future`
- **When** a data refresh inserts a new match scheduled for today
- **Then** the slot MUST transition to `upcoming-today` and select
  the new candidate per §4.3

### AC-12: both team flags are prominent in two-team states

- **Given** the slot is in `live-single`, `upcoming-today`, or
  `upcoming-future`
- **When** the slot is rendered
- **Then** both teams' circular flag medallions MUST be visually
  prominent (a primary visual anchor of the slot, not a small icon)
- **And** each team's country name MUST appear adjacent to its
  medallion in uppercase
- **And** the composition MUST give both teams visually equal weight

### AC-13: background halo carries hint of both teams' colors

- **Given** the slot is in a two-team state (per AC-12)
- **When** the slot is rendered
- **Then** the slot's background MUST carry a subtle tint derived
  from each team's primary color
- **And** the tint MUST NOT reduce body-text contrast below the
  thresholds set by `theming.md` §6
- **And** the tint MUST be perceptible as a hint, not as a
  full-bleed brand panel

### AC-14: live-multiple keeps the slot coherent without a derby tableau

- **Given** two or more matches are simultaneously live
- **When** the slot enters `live-multiple`
- **Then** the slot MUST NOT render team medallions, country names,
  or the per-team background halo
- **And** the slot MUST occupy the same surface footprint and
  anchor the live indicator in the same position as in `live-single`
- **And** the user MUST perceive the slot as the same component,
  not as a layout break

### AC-15: matches list uses consistent mini-medallions

- **Given** the list of today's matches is rendered
- **When** any list row is displayed
- **Then** each team in that row MUST be accompanied by a mini
  circular flag medallion adjacent to its name
- **And** mini medallions MUST be visually consistent with the
  featured medallions (same shape and border treatment, scaled
  down)

### AC-16: data-carried score is ignored when slot is live-single

- **Given** the resolved featured state is `live-single`
- **And** the underlying match payload carries a `score` field from
  a prior daily-refresh snapshot
- **When** the slot renders
- **Then** the renderer MUST NOT display the carried score in any
  form (no number, no scoreline, no aria-label that exposes it)
- **And** the only "live progression" cue the slot exposes MUST be
  the localized in-progress text indicator per §7.0
