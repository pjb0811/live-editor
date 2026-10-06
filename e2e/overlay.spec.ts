import { expect, test } from '@playwright/test';

// #564: in `shadow` mode, a modal portaled into the preview's `container`
// opens inside the shadow root and over the preview's box, not over the page.
test.describe('shadow frame overlays (#564)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/fixture.html?scenario=overlay');
    await expect(page.locator('#count')).toHaveText('Count 0');
  });

  test('the overlay layer lets clicks reach the preview', async ({ page }) => {
    await page.locator('#count').click();

    await expect(page.locator('#count')).toHaveText('Count 1');
  });

  test('a modal opens over the preview, inside the shadow root', async ({
    page,
  }) => {
    await page.locator('#open').click();

    const body = page.locator('#modal-body');

    await expect(body).toBeVisible();

    const inShadowRoot = await body.evaluate(
      element => element.getRootNode() instanceof ShadowRoot,
    );

    expect(inShadowRoot).toBe(true);

    // The mask covers the preview's box, not the viewport.
    const box = await page.locator('#preview-box').boundingBox();
    const mask = await body.evaluate(element => {
      const root = element.getRootNode() as ShadowRoot;
      const masks = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(
        el => {
          const style = getComputedStyle(el);

          return (
            style.position === 'fixed' &&
            !el.contains(element) &&
            el.offsetWidth > 0
          );
        },
      );
      const rect = masks[0]!.getBoundingClientRect();

      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });

    expect(mask).toEqual({
      x: box!.x,
      y: box!.y,
      width: box!.width,
      height: box!.height,
    });

    // The modal itself sits inside that box.
    const dialog = await body.boundingBox();

    expect(dialog!.x).toBeGreaterThanOrEqual(box!.x);
    expect(dialog!.y).toBeGreaterThanOrEqual(box!.y);
    expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(box!.x + box!.width);
    expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(
      box!.y + box!.height,
    );

    // Its buttons take clicks.
    await page.locator('#close').click();
    await expect(body).toBeHidden();
  });
});
