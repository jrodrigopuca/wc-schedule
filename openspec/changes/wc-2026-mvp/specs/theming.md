# Capability Spec — theming

## 1. Purpose

Theming is a first-class concern of this app, not a cosmetic
afterthought. The product is consumed in moments of strong
attention (live matches) and in moments of glance-and-go (next
kickoff), often on mobile devices, often at night. A theme that
fights the user's environment — a blinding light surface on a dark
phone, or a washed-out dark surface in daylight — adds friction to
a UX whose entire premise is "answer the question in under a
second".

This spec defines the BEHAVIORAL contract for theming: which themes
exist, how the active theme is decided, how the choice persists,
how the visual surfaces adapt, and the non-negotiable guarantees
(no flicker, accessible contrast, identifiable live indicator).

Implementation specifics (token names, CSS variable layout, exact
palette values, override storage key) belong in `design.md`.

## 2. Themes supported

The app MUST support exactly two themes for MVP:

- **light** — designed for high-ambient-light environments.
- **dark** — designed for low-ambient-light environments.

Both themes are first-class. Neither is a degraded fallback of the
other. Both themes MUST receive equal design effort and MUST satisfy
the contrast guarantees of §6.

Additional themes (high-contrast, sepia, per-team) are OUT OF SCOPE
for MVP.

## 3. Source of truth & override

The active theme is decided by the following precedence, from
highest to lowest:

1. **Persisted user override**, if present.
2. **OS color-scheme preference** (`prefers-color-scheme`), if
   the device exposes one.
3. **Default fallback**: `light`.

### 3.1 OS preference

- The app MUST respect `prefers-color-scheme: dark` on cold load
  when no user override is persisted.
- The app MUST react to live changes in `prefers-color-scheme`
  while the app is open, provided no user override is set. A user
  switching their OS from light to dark MUST see the app follow.

### 3.2 Manual override

- The user MUST be able to set a manual override to `light` or
  `dark`.
- A manual override MUST persist across sessions (full app close,
  device reboot).
- The user MUST be able to CLEAR the override, returning the app
  to OS-driven behavior. Clearing is a distinct action from
  toggling between light and dark.
- While an override is set, changes to the OS preference MUST NOT
  affect the rendered theme.
- The override MUST be a single, local, per-device value. It MUST
  NOT be synced to any backend (there is no backend).

## 4. Behavior across surfaces

The active theme MUST be applied uniformly across every surface
the user sees, including:

- The app header / title bar.
- The featured slot, including its derby tableau and team-color
  halo (see `featured.md` §7). The halo's tint MUST adapt to the
  active theme so it remains a subtle hint in both modes.
- The list of today's matches, including mini-medallions and any
  badges.
- The live indicator and any status badges (see also §6).
- Calls-to-action (install PWA, enable notifications) and their
  hover/focus/active states.
- System chrome that the OS draws on behalf of the page: scrollbars,
  text-selection color, form-control defaults, and the browser
  address-bar color where the platform exposes it.

To make system chrome follow the theme, the document MUST declare
the active color scheme to the user agent (e.g. via the
`color-scheme` mechanism). Declaring `color-scheme` for both
themes is REQUIRED so that scrollbars and native controls do not
visually fight the rest of the surface.

A theme switch (manual or OS-driven) MUST apply to every surface
in the same paint. The app MUST NOT enter a transient state where
some surfaces are in one theme and others are in the other.

## 5. No flicker on load

The chosen theme MUST be applied BEFORE the first paint of any
themed content. Specifically:

- A cold load with OS preference `dark` MUST NOT briefly render in
  light before switching to dark.
- A cold load with a persisted override MUST NOT briefly render in
  the OS-preferred theme before switching to the overridden one.
- A warm load from the service-worker cache MUST follow the same
  guarantee.

Because the app is a SPA with no SSR, the theme decision MUST be
inlined into the initial document so it is available synchronously,
before the framework boots. Deferring the decision to a framework
lifecycle hook is NOT acceptable; it would race against the first
paint and produce FOUC.

The first paint MAY show empty data regions while matches load —
that is unrelated to theming and is not a flicker.

## 6. Accessibility

Both themes MUST meet WCAG 2.1 Level AA contrast on:

- Body text against its background.
- Secondary text (timestamps, stage labels, country names) against
  its background.
- Interactive elements (buttons, links, focus rings) against their
  background, in their default and focused states.
- The mini-medallions' surrounding chrome (borders, separators)
  against the list background.

The **LIVE indicator** is held to a stricter bar than ambient text:

- It MUST remain unmistakable in BOTH themes — visually distinct
  from any non-live badge, readable at a glance, and not reliant
  on color alone (a shape, label, or motion cue MUST accompany the
  color).
- In dark mode, the LIVE indicator MUST NOT be a dim red-on-black
  that disappears into the surface. It MUST retain at least the
  same level of attention-grabbing prominence it has in light mode.

The team-color halo in the featured slot (see `featured.md` §7.2)
MUST NOT be allowed to violate any of the above thresholds. If a
team's primary color would reduce contrast below AA when used as
a halo tint in the active theme, the halo MUST be desaturated or
darkened/lightened until the threshold is met. Contrast wins over
brand fidelity.

Focus indicators MUST be visible in both themes and MUST NOT
depend solely on the OS default focus ring (which can vanish under
dark backgrounds).

## 7. Cross-references

- Visual identity contract for the featured slot (derby treatment,
  medallions, halo) → `featured.md` §7
- Surfaces consuming the active theme indirectly (list rendering,
  status badges) → `matches.md`, `featured.md`
- Service-worker caching that must not serve a stale, pre-theming
  shell → `pwa.md`

## 8. Acceptance criteria (Given/When/Then)

### AC-1: cold load follows OS dark

- **Given** the device exposes `prefers-color-scheme: dark`
- **And** no user override is persisted
- **When** the app cold-loads
- **Then** the first painted frame MUST be the dark theme

### AC-2: cold load follows OS light

- **Given** the device exposes `prefers-color-scheme: light` (or
  no preference)
- **And** no user override is persisted
- **When** the app cold-loads
- **Then** the first painted frame MUST be the light theme

### AC-3: override persists across reload

- **Given** the user has set a manual override to `dark` in a
  previous session
- **And** the device's OS preference is `light`
- **When** the app cold-loads in a new session
- **Then** the rendered theme MUST be `dark`

### AC-4: clearing the override returns to OS-driven

- **Given** a manual override of `dark` is persisted
- **And** the device's OS preference is `light`
- **When** the user clears the override
- **Then** the rendered theme MUST become `light` without a reload
- **And** subsequent changes to the OS preference MUST be followed

### AC-5: no FOUC on cold load

- **Given** any combination of OS preference and persisted override
- **When** the app cold-loads
- **Then** at no observable moment MUST a themed surface paint in
  the wrong theme before switching to the correct one
- **And** the `color-scheme` declaration MUST be applied before
  the first paint so system chrome matches

### AC-6: live indicator remains identifiable in dark

- **Given** the active theme is `dark`
- **And** at least one match is in its live window
- **When** the live indicator is rendered (in the featured slot
  and/or in the matches list)
- **Then** the indicator MUST remain visually unmistakable
- **And** it MUST NOT rely on color alone to convey "live"
- **And** it MUST meet at least WCAG AA contrast against its
  surface

### AC-7: OS preference change is followed when no override is set

- **Given** the app is open
- **And** no user override is persisted
- **And** the active theme is `light` because the OS preference is
  `light`
- **When** the user switches their OS to dark while the app is
  open
- **Then** the rendered theme MUST switch to `dark`
- **And** every themed surface MUST update in the same paint

### AC-8: OS preference change is ignored when an override is set

- **Given** the app is open
- **And** a manual override of `light` is persisted
- **When** the user switches their OS to dark
- **Then** the rendered theme MUST remain `light`
