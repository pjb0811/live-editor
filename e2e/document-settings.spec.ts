import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// A document setting edited in the panel reaches every section's preview
// (#770), in place and in iframes.
for (const mode of ['in place', 'iframe'] as const) {
  test(`${mode}: a document setting reaches every section`, async ({
    page,
  }) => {
    const query = mode === 'iframe' ? '&mode=iframe' : '';
    const greetings = (target: Page) =>
      mode === 'iframe'
        ? Promise.all(
            [0, 1].map(index =>
              target
                .locator('iframe')
                .nth(index)
                .contentFrame()
                .getByTestId('greeting')
                .textContent(),
            ),
          )
        : target.getByTestId('greeting').allTextContents();

    await page.goto(`/e2e/fixture.html?scenario=settings${query}`);

    await expect
      .poll(() => greetings(page))
      .toEqual(['Hello one', 'Hello two']);

    const field = page
      .getByRole('group', { name: 'settings' })
      .locator('textarea');

    await field.fill('Hi');
    await field.blur();

    await expect(page.getByTestId('source')).toContainText(
      "const settings = { greeting: 'Hi' };",
    );
    await expect.poll(() => greetings(page)).toEqual(['Hi one', 'Hi two']);
  });
}
