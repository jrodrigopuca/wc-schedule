import { expect, test } from '@playwright/test'

test('the app shell loads and has a non-empty title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/.+/)
})
