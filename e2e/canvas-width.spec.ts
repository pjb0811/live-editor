import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// `canvasWidth` (#751) at a 1280 px window, in the default layout.
const sortables = (page: Page) =>
  page.locator('[aria-roledescription="sortable"]');

const sectionWidth = async (page: Page) =>
  (await sortables(page).first().boundingBox())!.width;

// Inside a section's iframe: the iframe's width and height, where its
// content ends (the last paragraph and its bottom margin), and whether its
// own media query for 640 px matches.
const iframeState = (page: Page) =>
  page
    .locator('iframe')
    .first()
    .evaluate(element => {
      const iframe = element as HTMLIFrameElement;
      const paragraph = iframe.contentDocument!.querySelector('p')!;

      return {
        width: iframe.getBoundingClientRect().width,
        height: iframe.getBoundingClientRect().height,
        contentBottom:
          paragraph.getBoundingClientRect().bottom +
          parseFloat(getComputedStyle(paragraph).marginBottom),
        wide: iframe.contentWindow!.matchMedia('(min-width: 640px)').matches,
      };
    });

const setWidth = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).click();

test.describe('iframe frames', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/fixture.html?scenario=canvas-width&mode=iframe');
    await expect(page.locator('iframe')).toHaveCount(2);
  });

  test('render sections at the width, with breakpoints following it', async ({
    page,
  }) => {
    await expect.poll(() => iframeState(page)).toMatchObject({ wide: true });

    const fullWidth = await sectionWidth(page);

    expect(fullWidth).toBeGreaterThan(640);

    await setWidth(page, 'Width 390');

    await expect
      .poll(() => iframeState(page))
      .toMatchObject({ width: 390, wide: false });
    expect(await sectionWidth(page)).toBe(390);

    await setWidth(page, 'Full width');

    await expect.poll(() => sectionWidth(page)).toBe(fullWidth);
    await expect.poll(() => iframeState(page)).toMatchObject({ wide: true });
  });

  // The paragraph wraps to more lines when narrower, so the height has to
  // grow, then shrink back.
  test('re-measures an auto-height iframe after a width change', async ({
    page,
  }) => {
    const settled = async () => {
      const state = await iframeState(page);

      return Math.abs(state.height - state.contentBottom) <= 1;
    };

    await expect.poll(settled).toBe(true);

    const fullHeight = (await iframeState(page)).height;

    await setWidth(page, 'Width 390');
    await expect
      .poll(async () => (await iframeState(page)).height)
      .toBeGreaterThan(fullHeight);
    await expect.poll(settled).toBe(true);

    await setWidth(page, 'Full width');
    await expect
      .poll(async () => (await iframeState(page)).height)
      .toBe(fullHeight);
    await expect.poll(settled).toBe(true);
  });

  test('scrolls the canvas sideways when it is narrower than the width', async ({
    page,
  }) => {
    await setWidth(page, 'Width 2000');

    await expect.poll(() => sectionWidth(page)).toBe(2000);

    const canvas = page.locator('[data-frame-container]');
    const overflow = await canvas.evaluate(element => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
  });

  test('selecting, the toolbar, the picker and dragging work at 320 px', async ({
    page,
  }) => {
    await setWidth(page, 'Width 320');
    await expect.poll(() => sectionWidth(page)).toBe(320);

    const first = sortables(page).first();
    const box = (await first.boundingBox())!;

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByText('Please select a section.')).toBeHidden();

    // Every toolbar button inside the section.
    const buttons = first.locator('button');
    const count = await buttons.count();

    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index++) {
      const button = (await buttons.nth(index).boundingBox())!;

      expect(button.x).toBeGreaterThanOrEqual(box.x);
      expect(button.x + button.width).toBeLessThanOrEqual(box.x + box.width);
    }

    // The picker selects the second section from a click on its title.
    await page.getByRole('button', { name: 'Pick an element' }).click();

    const title = page
      .locator('iframe')
      .nth(1)
      .contentFrame()
      .getByRole('heading', { name: 'Second' });

    await title.click();
    await expect(sortables(page).nth(1)).toHaveClass(/sectionSelected/);

    // Dragging the second section above the first.
    const second = (await sortables(page).nth(1).boundingBox())!;

    await page.mouse.move(second.x + 20, second.y + 20);
    await page.mouse.down();
    await page.mouse.move(second.x + 20, second.y + 10, { steps: 4 });
    await page.mouse.move(box.x + 20, box.y + 5, { steps: 12 });
    await page.mouse.up();

    await expect
      .poll(() =>
        page
          .locator('iframe')
          .first()
          .contentFrame()
          .locator('h2')
          .textContent(),
      )
      .toBe('Second');
  });
});

// Shadow and in-place sections narrow, but their media queries follow the
// browser window: they share the host page's viewport.
test('a shadow section narrows while its breakpoints follow the window', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=canvas-width&mode=shadow');
  await expect(sortables(page)).toHaveCount(2);

  await setWidth(page, 'Width 390');

  await expect.poll(() => sectionWidth(page)).toBe(390);
  expect(
    await page.evaluate(() => matchMedia('(min-width: 640px)').matches),
  ).toBe(true);
});
