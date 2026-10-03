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
