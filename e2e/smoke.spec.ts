// Smoke E2E. Three goals only:
//   1. The app boots end-to-end against the production preview server
//      (so the build pipeline and PWA injection are exercised).
//   2. The main user paths render: chip strip is visible, and either the
//      loading copy OR the featured / matches surface appears (the data
//      adapter's race resolves async, so we accept whichever wins).
//   3. Hash-based navigation works: `/#/preview` swaps in the gallery,
//      back link returns to the main view.
//
// We intentionally do NOT exercise the full test matrix here — the
// component- and unit-level tests already cover state correctness.
// Smoke = "did the shell boot and could a user navigate".
//
// The `playwright.config.ts` already pins the baseURL to
// `http://localhost:4173/wc-schedule/` and boots `pnpm run preview`
// before tests run, so `page.goto('/')` lands at the right place.
import { expect, test } from '@playwright/test'

test('main view: chip strip renders, content surface appears', async ({ page }) => {
  await page.goto('/')

  // Day chip strip is the persistent top control on the main route.
  // It carries an aria-label (`day.selector.aria`) — we match by role
  // so we don't have to know the exact localized label.
  const dayStrip = page.getByRole('navigation').first()
  await expect(dayStrip).toBeVisible()

  // The body MUST resolve to either the loading state (loading title) or
  // a content surface (FeaturedCard / MatchesList). We can't predict
  // which because the data adapter chain is async and the timing
  // depends on the SW cache state.
  //
  // Localized loading copy: `main.loading.title` is "Cargando partidos…"
  // in es and "Loading matches…" in en. We accept either.
  // Otherwise: at least one h1 should be present (featured eyebrow or
  // day title, depending on state).
  const loadingTitle = page.getByText(/Cargando partidos|Loading matches/)
  const anyHeading = page.getByRole('heading').first()

  await expect(loadingTitle.or(anyHeading)).toBeVisible({ timeout: 10_000 })
})

test('navigate to /preview: gallery section ids appear', async ({ page }) => {
  await page.goto('/')

  // The gallery link in MainView reads from i18n (`nav.openGallery`).
  // Click via href since the localized copy varies. The link's href
  // ends in `#/preview` regardless of locale.
  const galleryLink = page.locator('a[href="#/preview"]').first()
  await expect(galleryLink).toBeVisible({ timeout: 10_000 })
  await galleryLink.click()

  // PreviewView documents each FeaturedState variant with a literal
  // `<code>` label — these are NOT localized, so we can match by text.
  await expect(page.getByText('Featured · upcoming-today')).toBeVisible()
})

test('back to main: returns from gallery to the main shell', async ({ page }) => {
  await page.goto('/#/preview')

  await expect(page.getByText('Featured · upcoming-today')).toBeVisible({ timeout: 10_000 })

  // The back link in PreviewView is the only `href="#"` anchor in the
  // gallery footer. Localized label, but the href is stable.
  const backLink = page.locator('a[href="#"]').first()
  await backLink.click()

  // Back on main: the chip strip is the canonical top control.
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 10_000 })
})
