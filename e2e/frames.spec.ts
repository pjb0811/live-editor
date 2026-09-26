import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// Section 0 renders normally; section 1 throws while rendering until the
// host fixes its code. Both frame modes, since each isolates a section in a
// different way: its own iframe document, or a shadow root in the host page.
for (const mode of ['iframe', 'shadow'] as const) {
  // The element inside a section's frame. Shadow roots here are open, which
  // Playwright's CSS locators pierce; iframes need their own content frame.
  const inSection = (page: Page, index: number, selector: string): Locator =>
    mode === 'iframe'
      ? page.locator('iframe').nth(index).contentFrame().locator(selector)
      : page.locator(selector);

  // What isolates the section: the iframe element, or the shadow root's host.
  // Tagging it and finding the tag again later proves it was not remounted.
  const tagFrame = (locator: Locator) =>
    locator.evaluate(element => {
      const root = element.getRootNode();
      const frame =
        root instanceof ShadowRoot
          ? root.host
          : element.ownerDocument.defaultView!.frameElement!;

      (frame as HTMLElement).dataset.testTag = 'original';
    });

  const frameTag = (locator: Locator) =>
    locator.evaluate(element => {
      const root = element.getRootNode();
      const frame =
        root instanceof ShadowRoot
          ? root.host
          : element.ownerDocument.defaultView!.frameElement!;

      return (frame as HTMLElement).dataset.testTag ?? null;
    });

  const color = (page: Page) =>
    inSection(page, 0, '#themed').evaluate(
      element => getComputedStyle(element).color,
    );

  test.describe(`${mode} frames`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/e2e/fixture.html?scenario=frames&mode=${mode}`);
      await expect(inSection(page, 0, '#themed')).toHaveText('themed text');
    });

    test('a section that throws recovers in place once its code is fixed', async ({
      page,
    }) => {
      const error = inSection(page, 1, 'text=Rendering Error');

      // The failure stays in its own slot; the healthy section is unaffected.
      await expect(error).toBeVisible();
      await expect(inSection(page, 1, 'text=brokenValue')).toBeVisible();
      await tagFrame(error);

      await page.getByRole('button', { name: 'Fix broken section' }).click();

      const fixed = inSection(page, 1, '#broken');

      await expect(fixed).toHaveText('fixed section');
      await expect(inSection(page, 1, 'text=Rendering Error')).toHaveCount(0);
      // The fix itself is the recovery signal; the frame, its document or
      // shadow root, and everything loaded into it stay in place.
      expect(await frameTag(fixed)).toBe('original');
    });

    test('host stylesheet changes reach the section and are removed with it', async ({
      page,
    }) => {
      const initial = await color(page);

      await page.getByRole('button', { name: 'Add host style' }).click();
      await expect.poll(() => color(page)).toBe('rgb(255, 0, 0)');

      await page.getByRole('button', { name: 'Change host style' }).click();
      await expect.poll(() => color(page)).toBe('rgb(0, 0, 255)');

      // A removed host style must not linger in the frame (#338).
      await page.getByRole('button', { name: 'Remove host style' }).click();
      await expect.poll(() => color(page)).toBe(initial);
    });
  });
}
