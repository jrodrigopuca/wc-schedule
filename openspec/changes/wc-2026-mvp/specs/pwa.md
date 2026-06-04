# Capability Spec — pwa

## 1. Purpose

Describe the behavior of the application as an installable,
offline-capable progressive web app: when an install affordance is
available, what the user sees on cold and warm loads (online and
offline), and how new content reaches the user after a deploy.

This spec defines BEHAVIOR only. Match content and notification
behavior are owned by `matches.md` and `notifications.md`
respectively.

## 2. Definitions

- **Cold load**: the user opens the app and the browser has no
  cached shell or data from a previous visit.
- **Warm load**: the user opens the app and the browser already has
  a cached shell and last-known data from a previous visit.
- **App shell**: the static assets required to render the empty UI
  (markup, styling, scripts, fonts, icons).
- **Last-known data**: the most recent successfully loaded matches
  payload (see `data-source.md`).
- **Install affordance**: the user-visible entry point to install
  the PWA to the home screen / app launcher. This MAY be the
  browser's built-in affordance, an in-app prompt surfaced when the
  platform fires the install event, or both.

## 3. Install affordance — availability conditions

- The install affordance MUST be available only when the runtime
  platform reports the app as installable (i.e. PWA install criteria
  are met: served over HTTPS, manifest present and valid, service
  worker registered, etc.).
- The app MUST NOT display an in-app install affordance on platforms
  that already provide a native built-in install button in the URL
  bar, unless deferring entirely to the browser would hide the
  capability from typical users — in which case the in-app affordance
  MAY also be shown.
- The app MUST NOT show the install affordance on devices where the
  app is already installed and being launched in standalone mode.
- The install affordance MUST be passive: the app MUST NOT
  auto-prompt on first load. The user MUST initiate installation.

## 4. Offline behavior — cold load

- The first visit by definition requires network connectivity to
  fetch the shell and the initial data payload. A purely-offline
  first visit MUST display a clear "no connection" surface and MUST
  NOT pretend to render an empty app.
- After the first successful load, the service worker MUST cache
  the app shell and the last-known data. From then on, cold loads
  fall under §5.

## 5. Offline behavior — warm load

- A warm load MUST render the app shell from cache without waiting
  on the network.
- If the network is reachable, the app MUST attempt to fetch fresh
  data (see `data-source.md` §freshness).
- If the network is unreachable, the app MUST render the last-known
  data and MUST clearly indicate that the data may be stale (a
  passive, non-blocking signal — not a modal).
- All derived UI (today's list, featured slot, countdowns, live
  classification) MUST continue to function from the last-known data
  without network access.
- Scheduled notifications MUST continue to function on warm loads
  regardless of network state (see `notifications.md` §6.1).

## 6. Update strategy from the user's POV

- New deploys produce a new app shell version and potentially a new
  data payload.
- The user MUST NOT be blocked by an update process. When a new
  shell version is detected, the new version SHOULD activate on the
  next full app load (next time the user opens the app or refreshes).
- The app MAY surface a passive "new version available" hint, but
  MUST NOT auto-reload while the user is interacting.
- New data MAY become visible without a full shell update, on the
  cadence defined in `data-source.md` §freshness.
- The user MUST NOT see stale data persistently after a successful
  network refresh: once new data is fetched, it MUST replace the
  in-memory state and the UI MUST re-derive from it.

## 7. Cross-references

- Data source contract, freshness and fallback rules → `data-source.md`
- Local notifications survive offline → `notifications.md`
- "Today" semantics that the offline UI must continue to honor →
  `matches.md`

## 8. Acceptance criteria (Given/When/Then)

### AC-1: First visit needs network

- **Given** the user has never visited the app
- **And** the device is offline
- **When** the user navigates to the app
- **Then** the app MUST display a clear "no connection" surface
- **And** MUST NOT render an empty or broken UI

### AC-2: Warm load offline

- **Given** the user previously visited the app online
- **And** the device is now offline
- **When** the user opens the app
- **Then** the app shell MUST render from cache
- **And** the last-known matches MUST be displayed
- **And** a passive "data may be stale" indicator MUST be visible

### AC-3: Warm load online

- **Given** the user previously visited the app and the shell is
  cached
- **And** the device is online
- **When** the user opens the app
- **Then** the cached shell MUST render immediately
- **And** the app MUST attempt to fetch fresh data per `data-source.md`

### AC-4: Install affordance availability

- **Given** the platform reports the app as installable
- **And** the app is not currently running in standalone mode
- **When** the user opens the app
- **Then** an install affordance MUST be discoverable (browser
  built-in, in-app, or both)

### AC-5: No install affordance when already installed

- **Given** the user has installed the app and is opening it in
  standalone mode
- **When** the app renders
- **Then** the in-app install affordance MUST NOT be shown

### AC-6: No auto-install prompt

- **Given** the user opens the app for the first time online
- **When** the app loads
- **Then** an install prompt MUST NOT appear automatically; user
  initiation is required

### AC-7: New shell activates on next load

- **Given** a new deploy has produced a new app shell version
- **And** the user is mid-interaction with the previous version
- **When** the new version is detected
- **Then** the app MUST NOT force-reload mid-interaction
- **And** the new shell MUST activate on the next full open or
  refresh

### AC-8: Stale data replaced after refresh

- **Given** the app rendered last-known data offline
- **When** the device regains connectivity and a fresh data fetch
  succeeds
- **Then** the in-memory state MUST be replaced
- **And** the UI (list, featured slot, countdowns) MUST re-derive
  from the new data
- **And** the "data may be stale" indicator MUST be cleared

### AC-9: Derived UI works offline

- **Given** the app is in a warm-load offline state
- **When** time advances past a match's kickoff
- **Then** the featured slot MUST transition to a live state per
  `featured.md` §5 without any network access
