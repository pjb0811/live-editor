import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// Each section's iframe, in canvas order: its text, whether the script from
// `frame.scripts` ran in its document, and the color `frame.styles` gives the
// text.
const frames = (page: Page) =>
  page.locator('iframe').evaluateAll(iframes =>
    iframes.map(iframe => {
      const doc = (iframe as HTMLIFrameElement).contentDocument!;
      const text = doc.querySelector('p');

      return {
        text: text?.textContent,
        script: doc.documentElement.dataset.frameScript,
        color: text && getComputedStyle(text).color,
      };
    }),
  );

const section = (text: string) => ({
  text,
  script: 'loaded',
  color: 'rgb(0, 128, 0)',
});

// Reordering sections moves an iframe in the DOM, which reloads its
// document. The script and style injected into the old document have to be
// injected into the new one too.
test('sections keep their injected scripts and styles after a reorder', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=reorder');

  await expect
    .poll(() => frames(page))
    .toEqual([section('First section'), section('Second section')]);

  await page.getByRole('button', { name: 'Swap sections' }).click();

  await expect
    .poll(() => frames(page))
    .toEqual([section('Second section'), section('First section')]);
});

// The canvas sections in order, by the names screen readers hear.
const sortables = (page: Page) =>
  page.locator('[aria-roledescription="sortable"]');

// A keyboard move reorders the DOM, which drops focus in a browser; the
// section that moved keeps it (#640).
test('Alt+Arrow moves the focused section and keeps it focused', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=reorder');

  await expect
    .poll(() => frames(page))
    .toEqual([section('First section'), section('Second section')]);

  await sortables(page).first().focus();
  await page.keyboard.press('Alt+ArrowDown');

  await expect
    .poll(() => frames(page))
    .toEqual([section('Second section'), section('First section')]);
  await expect(sortables(page).nth(1)).toBeFocused();

  await page.keyboard.press('Alt+ArrowUp');

  await expect
    .poll(() => frames(page))
    .toEqual([section('First section'), section('Second section')]);
  await expect(sortables(page).first()).toBeFocused();
});

test('Control+D copies the focused section and focuses the copy', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=reorder');

  await expect(sortables(page)).toHaveCount(2);

  await sortables(page).first().focus();
  await page.keyboard.press('Control+d');

  await expect(sortables(page)).toHaveCount(3);
  await expect(sortables(page).nth(1)).toBeFocused();
});
