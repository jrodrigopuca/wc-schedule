# Capability Spec — notifications

## 1. Purpose

Describe the behavior of the local pre-match notification capability:
how permission is acquired, when notifications fire, what they say,
and how the system MUST behave under degraded conditions.

This spec defines BEHAVIOR only. The list of matches eligible for
scheduling is provided by `matches.md`; the pre-match lead time
(15 minutes for MVP) is locked by the proposal.

## 2. Definitions

- **Lead time**: the fixed duration before kickoff at which a
  notification is delivered. MVP value: 15 minutes. This is a
  product constant for MVP and MUST NOT be user-configurable.
- **Eligible match**: a match in state `scheduled` whose kickoff
  instant is at least one lead-time-window from now.
- **Notification permission**: the per-origin user permission to
  display system notifications, governed by the user's browser.

## 3. Permission lifecycle

The system MUST track the following permission states from the
user's perspective:

- **not-requested** — the app has not yet asked. No notification
  surfaces have been engaged.
- **prompt** — the user is being shown the browser's native
  permission dialog as a result of a user gesture.
- **granted** — the user accepted; notifications MAY be scheduled.
- **denied** — the user explicitly refused this session or
  permanently. Notifications MUST NOT be scheduled or fired.
- **blocked** — equivalent to `denied` at the browser level after a
  previous refusal; the app cannot re-prompt programmatically and
  MUST instead provide instructions for the user to re-enable from
  browser settings.

Rules:

- Permission MUST be requested ONLY in direct response to an
  explicit user gesture (e.g. tapping an "enable reminders" affordance).
- The app MUST NOT auto-prompt on first load.
- If permission is `denied` or `blocked`, the app MUST NOT re-prompt
  in the same session. It MAY surface a passive hint explaining how
  to re-enable from the browser settings.
- The permission state MUST be re-read on visibility regain, since
  the user may change it via browser settings while the app is
  backgrounded.

## 4. Trigger rule

- For every eligible match, the app MUST attempt to deliver a
  notification at `kickoff - 15 minutes` (the lead time).
- Each match MUST trigger AT MOST ONE pre-match notification per
  scheduling round (see §6 on deduplication).
- A match whose `kickoff - 15 minutes` is in the past at the time of
  scheduling MUST NOT trigger a retroactive notification.
- Scheduling MUST happen at app boot (after permission is `granted`),
  on visibility regain, and after the in-memory match list is
  replaced.

## 5. Notification content contract

When a pre-match notification fires, it MUST include:

- The two team identifiers of the match.
- The competition stage of the match.
- An indication that the match starts soon (e.g. "empieza en 15 minutos").

When a pre-match notification fires, it MUST NOT include:

- A score, projected score, or any live result.
- Any personally identifying information.
- Any link to an external site or third party.
- Any advertising content.

The notification SHOULD be tagged in a way that allows the operating
system to collapse duplicates if the same match is scheduled more
than once (see §6).

## 6. Edge cases

### 6.1 Device offline

- Notifications are LOCAL. Offline state MUST NOT prevent a
  notification from firing, provided the app or its service worker
  was alive long enough to register the trigger.
- If the device is offline at notification time, delivery still
  occurs from the local schedule, not from a server push.

### 6.2 App closed / tab closed

- Once the user fully closes the tab AND the service worker has been
  evicted by the browser, no further notifications can fire. This is
  a browser-level limitation and is acceptable for MVP.
- If the service worker is alive but the tab is closed, the system
  SHOULD still deliver scheduled notifications where the platform
  supports it. This is best-effort, not contractual.

### 6.3 Tab backgrounded

- When the tab is backgrounded, scheduled notifications MUST still
  fire at the correct time within the platform's throttling limits.
- Throttling by the browser (timer coalescing, suspended tabs) MAY
  delay or drop notifications. The system MUST NOT attempt to work
  around this by polling or by keeping the page artificially alive.

### 6.4 Match postponed / cancelled after scheduling

- When an in-memory match transitions to `postponed` or `cancelled`
  AFTER its notification has been scheduled, the scheduled
  notification MUST be revoked if the platform allows it.
- If the platform does not allow revocation, the app SHOULD NOT
  attempt aggressive workarounds; the (now-stale) notification will
  fire, and that is acceptable for MVP.
- When a postponed match is re-scheduled to a new kickoff, it MUST
  be treated as a new eligible match for notification purposes,
  subject to deduplication (§6.5).

### 6.5 Duplicate firings

- The system MUST NOT deliver more than one pre-match notification
  per match per scheduling round.
- A scheduling round is defined as a single pass triggered by boot,
  visibility regain, or list replacement.
- Across multiple rounds (e.g. boot, then visibility regain), the
  system MUST detect that a notification has already been scheduled
  for a given match and MUST NOT register a second timer for the
  same `(match id, kickoff instant)` pair.
- If the kickoff instant for a known match changes (postponement),
  the prior schedule is invalidated and a new one MAY be created.

### 6.6 Clock drift

- The 15-minute lead time is computed from the difference between
  the kickoff instant and the device's current time at the moment of
  scheduling.
- The system MUST NOT decrement a stored countdown; the trigger
  MUST be anchored to the absolute kickoff instant.
- Devices with significantly skewed clocks WILL produce skewed
  notification times. This is an accepted limitation; see
  proposal §9.

## 7. Cross-references

- Source of match identity, kickoff and state → `matches.md`
- Featured-slot behavior is independent of notifications and MUST
  NOT be coupled → `featured.md`
- Offline robustness for the app shell → `pwa.md`

## 8. Acceptance criteria (Given/When/Then)

### AC-1: No auto-prompt

- **Given** the user opens the app for the first time
- **When** the app finishes loading
- **Then** the browser permission dialog MUST NOT appear
  automatically

### AC-2: Gesture-gated prompt

- **Given** permission state is `not-requested`
- **When** the user taps the "enable reminders" affordance
- **Then** the browser permission dialog MUST appear
- **And** the app MUST react to both `granted` and `denied` outcomes

### AC-3: No re-prompt after denial

- **Given** permission state is `denied`
- **When** the user reopens the app in the same session
- **Then** the app MUST NOT attempt to prompt again
- **And** the app MAY show passive instructions for re-enabling

### AC-4: Scheduling on boot

- **Given** permission is `granted`
- **And** the in-memory match list contains an eligible match whose
  kickoff is 2 hours away
- **When** the app boots
- **Then** a notification MUST be scheduled for `kickoff - 15 minutes`

### AC-5: No retroactive notification

- **Given** an eligible match's kickoff is 10 minutes from now
  (less than the 15-minute lead time)
- **When** the app boots
- **Then** no pre-match notification MUST be scheduled for that match

### AC-6: Trigger content

- **Given** a scheduled notification fires for a match between teams
  A and B in stage S
- **When** the notification surfaces on the device
- **Then** it MUST display A, B, S, and a "starts soon" indication
- **And** it MUST NOT display a score, a tracking link, or ads

### AC-7: Deduplication across rounds

- **Given** a notification has been scheduled for match M at boot
- **When** a visibility-regain triggers another scheduling round
- **Then** a SECOND timer for the same `(match M, kickoff)` MUST NOT
  be registered

### AC-8: Postponement after scheduling

- **Given** a notification is scheduled for match M
- **When** match M transitions to `postponed` before firing
- **Then** the app MUST attempt to revoke the schedule
- **And** if revocation is unsupported by the platform, the firing
  notification is an accepted MVP limitation

### AC-9: Re-scheduling a postponed match

- **Given** match M was postponed and is later reported with a new
  kickoff that satisfies the eligibility rule
- **When** the next scheduling round runs
- **Then** a new notification MUST be scheduled for the new kickoff
- **And** it MUST NOT collide with any prior schedule for the old
  kickoff

### AC-10: Offline delivery

- **Given** a notification has been scheduled and the device goes
  offline before firing time
- **When** the firing time is reached
- **Then** the notification MUST still be delivered locally,
  provided the service worker or page is alive

### AC-11: Backgrounded tab

- **Given** a notification is scheduled and the tab is backgrounded
- **When** the firing time is reached
- **Then** the notification MUST fire within the platform's
  throttling window; if the platform drops the timer, that is an
  accepted MVP limitation

### AC-12: Permission revoked externally

- **Given** the app holds `granted` and has scheduled notifications
- **When** the user revokes permission via browser settings and
  returns to the tab
- **Then** on visibility regain the app MUST re-read permission
- **And** MUST NOT fire further notifications while permission is
  not `granted`
