import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// The canvas is for editing, not for use: the keyboard stays out of a
// section's content, as the pointer does (#747). Chromium, each frame mode.
for (const mode of ['in place', 'iframe', 'shadow'] as const) {
  const query = mode === 'in place' ? '' : `&mode=${mode}`;

  // An element of the first section's content. Shadow roots are open, which
  // Playwright's CSS locators pierce; an iframe needs its own frame.
  const inContent = (page: Page, testId: string): Locator =>
    mode === 'iframe'
      ? page.locator('iframe').first().contentFrame().getByTestId(testId)
      : page.getByTestId(testId);

  const sortables = (page: Page) =>
    page.locator('[aria-roledescription="sortable"]');

  test.describe(mode, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/e2e/fixture.html?scenario=cross-section${query}`);
      await expect(inContent(page, 'increment')).toBeVisible();
    });

    test('Tab goes from one section to the next, past the content', async ({
      page,
    }) => {
      await sortables(page).first().focus();
      await page.keyboard.press('Tab');

      await expect(sortables(page).nth(1)).toBeFocused();
    });

    // Tab, then Enter: what reaches the content's button when nothing
    // keeps the keyboard out. Here it selects the next section instead.
    test("Tab and Enter don't run the content's handler", async ({ page }) => {
      await sortables(page).first().focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      await expect(sortables(page).nth(1)).toHaveClass(/sectionSelected/);

      await expect(inContent(page, 'counts-1')).toHaveText(
        'app=0 store=0 provider=0',
      );
      expect(await page.evaluate(() => location.hash)).toBe('');
    });

    // The element picker still finds elements under the pointer.
    test('the element picker still picks inside the content', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Pick an element' }).click();

      const box = (await inContent(page, 'link').boundingBox())!;

      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      await expect(sortables(page).first()).toHaveClass(/sectionSelected/);
    });
  });
}
