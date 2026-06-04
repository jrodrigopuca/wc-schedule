# Capability Spec — data-source

## 1. Purpose

Describe the runtime contract between the app and "matches data": what
the app expects regardless of where the data physically comes from,
how it behaves under the two operational modes, what fallbacks apply
on failure, how stale data may be, and the non-negotiable security
constraint on credentials.

This spec defines BEHAVIOR only. Adapter shapes, file layout and
build-time wiring belong in `design.md`.

## 2. Runtime contract — what the app expects

The data layer MUST expose to the rest of the app:

- A way to obtain the current set of matches relevant to the
  tournament, where each match carries at minimum:
  - A stable, unique identifier.
  - Two participating team identifiers.
  - A canonical kickoff instant in UTC.
  - A competition stage label.
  - An explicit state where known (`scheduled`, `live`, `finished`,
    `postponed`, `cancelled`); MAY be absent, in which case the
    consumer derives it (see `matches.md` §5).
- A way to know when the loaded set was produced (a "data
  generated at" timestamp), used to reason about staleness (see §6).
- A way to be notified that fresh data has been loaded so derived
  state can re-evaluate (e.g. featured slot per `featured.md` §5).

The data layer MUST NOT expose:

- The identity of the upstream provider.
- Provider-specific fields, codes, or error shapes.
- Any credential, token, or signed URL.

Consumers of the data layer MUST treat it as a black box: same
contract, different behavior depending on mode.

## 3. Operational modes — behavior

The app MUST support two operational modes, selectable at build
time, with identical behavior contracts (§2):

### 3.1 manual mode

- The set of matches is provided by a fixture bundled with the app
  itself.
- This mode is intended for development, demos, and offline-first
  authoring.
- In this mode, the "data generated at" timestamp reflects the
  fixture's authoring time, not the current moment.
- In this mode, no network call to any provider is performed.

### 3.2 remote mode

- The set of matches is fetched from a statically-served snapshot
  produced by an out-of-band pipeline (see proposal §7).
- This snapshot is refreshed on a recurring schedule (see §6).
- In this mode, the fixture from §3.1 MUST still be available as
  the last-resort fallback (see §4).

Mode selection MUST be a build-time concern. The runtime MUST NOT
silently flip between modes based on network conditions.

## 4. Fallback rules

When the active source fails to load (network error, malformed
payload, schema mismatch, empty response), the following rules apply:

- The app MUST attempt to render last-known data from cache if
  available (see `pwa.md` §5).
- If the current snapshot is missing or fails validation, the app
  MUST attempt to load the most recent successful historical
  snapshot retained by the pipeline (see §7).
- If neither the current nor any historical snapshot is usable, the
  app MUST fall back to the bundled fixture (the `manual` payload),
  regardless of which mode is active.
- A fallback render MUST be accompanied by a passive indicator that
  the data is degraded — but MUST NOT block the UI behind a modal.
- A fallback MUST NOT silently mix entries from different sources;
  exactly one source is "active" at any moment.

The priority order on failure is:

1. Current `matches.json` (if valid).
2. Most recent valid historical snapshot retained by the pipeline.
3. Bundled fixture (manual payload).
4. A clear error surface, only if none of the above is possible (e.g.
   first-ever load with a corrupted fixture and no history).

## 5. Refresh behavior

- In `remote` mode, the app MUST attempt to load fresh data on cold
  load (when connectivity allows) and on visibility regain after a
  configurable interval (the interval itself is a `design.md`
  concern; the behavior is: re-validate, don't poll aggressively).
- A successful fresh load MUST replace the in-memory data set
  atomically (consumers see either the old set or the new set, never
  a partial merge).
- A failed fresh load MUST NOT clobber the in-memory data set.
- After a successful refresh, derived state (featured slot, today's
  list, notifications) MUST be re-evaluated.

## 6. Freshness expectations — tournament-aware refresh policy

The refresh cadence MUST be a function of where the current instant
sits relative to the tournament timeline. Three windows are defined:

### 6.1 Tournament window

- Bounds: from the kickoff instant of the opening match through the
  end instant of the final match, both inclusive.
- The refresh pipeline MUST run at least every 24 hours.
- Acceptable staleness: the data set displayed to a user MAY be up
  to ~26 hours old without the UI presenting an error (24h cadence
  plus a small margin for a single missed or delayed run). Beyond
  that, the UI SHOULD surface a passive "data may be outdated" hint.

### 6.2 Near-tournament window

- Bounds: a configurable lead-in before the opening match and a
  configurable tail-off after the final match. For MVP, the
  defaults are 30 days before kickoff and 7 days after the final.
- The refresh pipeline MUST run at least every 48 hours (every 2
  days).
- Acceptable staleness: the data set MAY be up to ~50 hours old
  without an outdated hint. Beyond that, the UI SHOULD surface the
  passive hint.

### 6.3 Outside both windows

- The refresh pipeline MAY still be invoked (e.g. by a fixed cron),
  but its invocation MUST be a no-op: it MUST NOT call the upstream
  provider, MUST NOT write a new snapshot, and MUST NOT create a
  new history entry.
- The UI MUST NOT present an "outdated data" hint outside both
  windows; staleness is expected and uninteresting there.

### 6.4 General rules

- The boundaries of the tournament window and the near-tournament
  window MUST be configurable in a single place (the pipeline
  configuration). They MUST NOT be hardcoded in client code.
- Live state is NEVER derived from "freshness" — it is always
  derived from the kickoff instant and the live window per
  `featured.md` §3. Stale data does not produce stale live states.
- Scores, if ever added later (out of scope for MVP), would not be
  reliable on this refresh cadence. This is why `featured.md` §4.1
  forbids score display in the live-single state.

## 7. Backup retention

To ensure a failed pipeline run never leaves the app in a worse
state than the previous good version, the data pipeline MUST retain
a bounded history of previous successful snapshots.

- A new history entry MUST be created ONLY after the new payload
  has passed validation (well-formed shape, non-empty match set,
  monotonically progressing "generated at" timestamp).
- A failed run (network error, malformed upstream payload,
  validation failure) MUST NOT rotate the current `matches.json`,
  MUST NOT create a history entry, and MUST NOT delete any existing
  history entry.
- The pipeline MUST retain the most recent N successful snapshots.
  N SHOULD be at least 7 (approximately one week of tournament days
  at the 24h cadence). Older snapshots beyond N MAY be pruned.
- Each retained snapshot MUST be addressable by the client at a
  predictable, ordered location, so the client can walk from
  newest to oldest when current fails validation.
- The "current" snapshot served at the canonical path MUST always
  equal the most recent retained history entry; the two MUST NOT
  diverge.
- Snapshot contents MUST be self-describing (they MUST carry their
  own "generated at" timestamp per §2) so the client can compute
  staleness without trusting filenames.

This section defines the CONTRACT. The exact storage layout,
filename scheme, and listing mechanism are a `design.md` concern.

## 8. Hard constraint — credential isolation

- The deployed client bundle MUST NOT contain any credential, token,
  signed URL, or other secret that grants access to the upstream
  data provider.
- The credential MUST exist exclusively in the secret store of the
  out-of-band pipeline that produces the snapshot.
- This constraint MUST be verifiable: any built artifact published
  to the hosting target can be inspected for the literal token, and
  the token MUST NOT appear.
- Violation of this constraint is a hard build failure, not a
  warning.

## 9. Cross-references

- Consumers of the data set → `matches.md`, `featured.md`,
  `notifications.md`
- Offline / warm-load consumption of last-known data → `pwa.md`
- Implementation specifics (adapter interface, file layout,
  pipeline mechanics) → `design.md` (to be authored)

## 10. Acceptance criteria (Given/When/Then)

### AC-1: Black-box contract

- **Given** a consumer (e.g. featured slot) requests current matches
- **When** the data layer responds
- **Then** the response MUST carry the fields defined in §2
- **And** the response MUST NOT carry provider-specific or
  credential-bearing fields

### AC-2: manual mode never calls the network

- **Given** the app is built in `manual` mode
- **When** the app boots and obtains its match set
- **Then** no network request to any external provider MUST occur

### AC-3: remote mode primary path

- **Given** the app is built in `remote` mode
- **And** the snapshot is reachable and well-formed
- **When** the app boots online
- **Then** the snapshot MUST be loaded
- **And** consumers MUST see the snapshot's matches

### AC-4: remote mode fallback to cache

- **Given** the app is built in `remote` mode
- **And** the snapshot fetch fails
- **And** a previously cached snapshot exists
- **When** the app boots
- **Then** the cached snapshot MUST be used
- **And** a passive degraded-data indicator MUST be shown per `pwa.md`

### AC-5: remote mode fallback to fixture

- **Given** the app is built in `remote` mode
- **And** the snapshot fetch fails
- **And** no cached snapshot is available
- **When** the app boots
- **Then** the bundled fixture MUST be used
- **And** a passive degraded-data indicator MUST be shown

### AC-6: no silent mode flipping

- **Given** the app is built in `manual` mode
- **When** the device is online and a remote snapshot would be
  reachable
- **Then** the app MUST NOT fetch the remote snapshot

### AC-7: atomic replacement on refresh

- **Given** the in-memory match set contains matches `{A, B, C}`
- **When** a refresh succeeds with `{A, B, C, D}`
- **Then** at no observable moment do consumers see a partial state
  (e.g. `{A, D}` with `B` and `C` missing)
- **And** derived state MUST be re-evaluated after replacement

### AC-8: failed refresh preserves state

- **Given** the in-memory match set contains `{A, B, C}`
- **When** a refresh attempt fails
- **Then** the in-memory set MUST remain `{A, B, C}`
- **And** no fallback substitution MUST occur

### AC-9: staleness budget inside tournament window

- **Given** the current instant is inside the tournament window
- **And** the loaded snapshot was generated 20 hours ago
- **When** the app renders
- **Then** the UI MUST NOT surface an "outdated data" warning
- **And** matches MUST be displayed normally

### AC-10: staleness exceeded inside tournament window

- **Given** the current instant is inside the tournament window
- **And** the loaded snapshot was generated 30 hours ago
- **When** the app renders
- **Then** a passive "data may be outdated" hint MUST be visible
- **And** the UI MUST still render the matches

### AC-11: live state independent of freshness

- **Given** the loaded snapshot is 40 hours old
- **And** a match's kickoff instant in the snapshot has passed
  within the live window
- **When** the featured slot evaluates state
- **Then** the match MUST be classified as live per `featured.md` §3
  regardless of snapshot age

### AC-12: no upstream token in bundle

- **Given** a build artifact of the deployed app
- **When** the artifact's bytes are scanned for the upstream API
  token
- **Then** the token MUST NOT appear anywhere in the bundle
- **And** any build that would embed the token MUST fail

### AC-13: refresh skipped outside both windows

- **Given** the current instant sits outside both the tournament
  window and the near-tournament window
- **When** the pipeline is invoked on its fixed schedule
- **Then** the invocation MUST be a no-op
- **And** no upstream call MUST be made
- **And** no new snapshot or history entry MUST be written

### AC-14: refresh cadence inside the near-tournament window

- **Given** the current instant sits inside the near-tournament
  window (lead-in or tail-off)
- **And** the most recent successful snapshot was generated less
  than 48 hours ago
- **When** the pipeline is invoked
- **Then** the pipeline MAY skip the upstream call until the 48h
  cadence is due
- **And** when the cadence is due, the pipeline MUST attempt a
  fresh fetch

### AC-15: refresh cadence inside the tournament window

- **Given** the current instant sits inside the tournament window
- **And** the most recent successful snapshot was generated 24 or
  more hours ago
- **When** the pipeline is invoked
- **Then** the pipeline MUST attempt a fresh fetch
- **And** on success a new history entry MUST be created per §7

### AC-16: client falls back to history when current fails validation

- **Given** the current `matches.json` exists but fails validation
- **And** at least one valid historical snapshot exists
- **When** the app boots
- **Then** the most recent valid historical snapshot MUST be loaded
- **And** a passive degraded-data indicator MUST be shown

### AC-17: client falls back to fixture when history is exhausted

- **Given** the current `matches.json` fails validation
- **And** every retained historical snapshot also fails validation
  or is unavailable
- **When** the app boots
- **Then** the bundled fixture MUST be used
- **And** a passive degraded-data indicator MUST be shown

### AC-18: failed pipeline run does not rotate state

- **Given** a previous successful snapshot is the current
  `matches.json`
- **When** the next pipeline run fails (upstream error, malformed
  payload, or validation failure)
- **Then** the current `matches.json` MUST remain unchanged
- **And** no new history entry MUST be created
- **And** no existing history entry MUST be deleted
