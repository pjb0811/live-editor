import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// `renderSectionToolbar` (#788): the host's controls in the selected
// section's toolbar, in Chromium.
const sortables = (page: Page) =>
  page.locator('[aria-roledescription="sortable"]');

const source = (page: Page) => page.getByTestId('source');

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixture.html?scenario=toolbar');
  await expect(sortables(page)).toHaveCount(2);
  await sortables(page)
    .first()
    .click({ position: { x: 5, y: 5 } });
});

test("shows the host's controls on the selected section, without the built-in buttons", async ({
  page,
}) => {
  const first = sortables(page).first();

  await expect(first.getByRole('button', { name: 'Count 0' })).toBeVisible();
  await expect(
    first.getByRole('button', { name: 'Delete section' }),
  ).toHaveCount(0);
  await expect(sortables(page).nth(1).getByRole('button')).toHaveCount(0);
});

test('Space and Enter press a host button instead of picking the section up', async ({
  page,
}) => {
  const count = sortables(page).first().getByRole('button', { name: /Count/ });
  const before = await source(page).textContent();

  await count.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');

  await expect(count).toHaveText('Count 2');
  await expect(source(page)).toHaveText(before!);
  await expect(sortables(page).first()).toHaveClass(/sectionSelected/);
});

test('a click on a host button keeps the section selected', async ({
  page,
}) => {
  await sortables(page).first().getByRole('button', { name: /Count/ }).click();

  await expect(sortables(page).first()).toHaveClass(/sectionSelected/);
});

test('Delete and Backspace in a host text field edit the text only', async ({
  page,
}) => {
  const note = sortables(page).first().getByLabel('Note');

  await note.fill('abc');
  await note.press('Backspace');
  await note.press('Home');
  await note.press('Delete');

  await expect(note).toHaveValue('b');
  await expect(sortables(page)).toHaveCount(2);
});

test('dragging a host range moves the range, not the section', async ({
  page,
}) => {
  const range = sortables(page).first().getByLabel('Amount');
  const before = await source(page).textContent();
  const box = (await range.boundingBox())!;

  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2 + 40, {
    steps: 10,
  });
  await page.mouse.up();

  await expect(range).not.toHaveValue('0');
  await expect(source(page)).toHaveText(before!);
});

test('the actions run the built-in moves and deletes, and hooks follow the selection', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', error => errors.push(error.message));

  await sortables(page).first().getByRole('button', { name: 'Lower' }).click();
  await expect(sortables(page).first()).toContainText('Second');
  // The moved section stays selected, now last, where it can't go lower.
  await expect(
    sortables(page).nth(1).getByRole('button', { name: 'Lower' }),
  ).toBeDisabled();

  await sortables(page)
    .first()
    .click({ position: { x: 5, y: 5 } });
  await sortables(page).first().getByRole('button', { name: 'Drop' }).click();
  await expect(sortables(page)).toHaveCount(1);
  await expect(source(page)).not.toContainText('data-id="t2"');

  expect(errors).toEqual([]);
});
