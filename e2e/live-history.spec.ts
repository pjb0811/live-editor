import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// `useLiveHistory` (#749) with `Live.Dnd` and `Live.Editor` on one document,
// in Chromium.
const sortables = (page: Page) =>
  page.locator('[aria-roledescription="sortable"]');

const source = (page: Page) => page.getByTestId('source');

const sourceText = async (page: Page) => (await source(page).textContent())!;

// The panel's text area for the selected section's title.
const titleField = (page: Page) => page.locator('[data-node-id] textarea');

// The canvas's notice while the document doesn't parse.
const staleNotice = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'syntax error' });

const undo = (page: Page) => page.keyboard.press('ControlOrMeta+z');
const redo = (page: Page) => page.keyboard.press('ControlOrMeta+Shift+z');

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixture.html?scenario=live-history');
  await expect(sortables(page)).toHaveCount(2);
});

test('a panel edit is one step, and the section stays selected', async ({
  page,
}) => {
  const before = await sourceText(page);

  await sortables(page)
    .first()
    .click({ position: { x: 5, y: 5 } });
  await titleField(page).fill('Edited title');
  // Back on the canvas, which commits the field.
  await sortables(page).first().focus();
  await expect(source(page)).toContainText('Edited title');

  await undo(page);
  await expect(source(page)).toHaveText(before);
  await expect(sortables(page).first()).toHaveClass(/sectionSelected/);
  await expect(titleField(page)).toHaveValue('First title');

  await redo(page);
  await expect(source(page)).toContainText('Edited title');
  await expect(sortables(page).first()).toHaveClass(/sectionSelected/);
});

test('a move and a delete are one step each', async ({ page }) => {
  const before = await sourceText(page);

  await sortables(page).first().focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect
    .poll(async () => (await sourceText(page)).indexOf('data-id="h2"'))
    .toBeLessThan((await sourceText(page)).indexOf('data-id="h1"'));

  await undo(page);
  await expect(source(page)).toHaveText(before);

  await sortables(page).first().focus();
  await page.keyboard.press('Delete');
  await expect(sortables(page)).toHaveCount(1);

  await undo(page);
  await expect(sortables(page)).toHaveCount(2);
  await expect(source(page)).toHaveText(before);

  await page.keyboard.press('Control+y');
  await expect(sortables(page)).toHaveCount(1);
});

test('Ctrl+Z in a panel text field or the code editor undoes text only', async ({
  page,
}) => {
  // A canvas step to keep: a move.
  await sortables(page).first().focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(sortables(page).first()).toContainText('Second');

  const moved = await sourceText(page);

  // The code editor: CodeMirror's own undo.
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('// note');
  await expect(source(page)).toContainText('// note');

  await undo(page);
  await expect(source(page)).not.toContainText('// note');
  // The move is still there.
  await expect(source(page)).toHaveText(moved);

  // The panel field: its own undo, nothing committed. The moved section is
  // selected, so select the other one.
  await sortables(page)
    .first()
    .click({ position: { x: 5, y: 5 } });
  await titleField(page).click();
  await titleField(page).press('End');
  await page.keyboard.type(' typed');
  await undo(page);
  await expect(titleField(page)).not.toHaveValue(/typed/);
  await expect(source(page)).toHaveText(moved);
});

test('typing is one step, and undo works while the document does not parse', async ({
  page,
}) => {
  const before = await sourceText(page);

  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('<<<');
  await expect(source(page)).toContainText('<<<');
  await expect(staleNotice(page)).toBeVisible();

  // On the canvas, the document-level undo takes the whole burst back.
  await sortables(page).first().focus();
  await undo(page);

  await expect(source(page)).toHaveText(before);
  await expect(staleNotice(page)).toHaveCount(0);
});
