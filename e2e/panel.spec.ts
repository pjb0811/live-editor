import { expect, test } from '@playwright/test';

test('keyboard Space and Shift+Space select an item range', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=selection');

  const checkboxes = page.getByRole('checkbox');

  await expect(checkboxes).toHaveCount(3);
  await checkboxes.nth(0).focus();
  await page.keyboard.press('Space');

  await expect(page.getByText('1 selected')).toBeVisible();
  await expect(checkboxes.nth(0)).toBeChecked();

  await checkboxes.nth(2).focus();
  await page.keyboard.press('Shift+Space');

  await expect(page.getByText('3 selected')).toBeVisible();

  for (const checkbox of await checkboxes.all()) {
    await expect(checkbox).toBeChecked();
  }
});

test('a moved nested JSX editor keeps focus and selection', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=fallback');

  await expect(page.locator('.cm-editor')).toHaveCount(2);
  await page.evaluate(() => window.browserTestEditor.focusAt('A content', 8));
  await expect
    .poll(() => page.evaluate(() => window.browserTestEditor.read('A content')))
    .toMatchObject({ selection: 8, hasFocus: true });

  // HTMLElement.click() runs the real Items move handler without moving
  // browser focus to the button; a pointer click would be an intentional
  // editor blur, which the editor must not reverse.
  await page.evaluate(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      'button:has(.lucide-arrow-up)',
    );
    buttons[1]?.click();
  });

  await expect
    .poll(() => page.evaluate(() => window.browserTestEditor.read('A content')))
    .toMatchObject({ selection: 8, hasFocus: true });
  await expect(page.getByTestId('source')).toHaveText(
    /B content[\s\S]*A content/,
  );
});

test('external and panel edits survive switching between DnD and Editor', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=surfaces');

  await expect(page.locator('[aria-roledescription="sortable"]')).toHaveCount(
    2,
  );
  await page.locator('[aria-roledescription="sortable"]').first().click();
  await expect(page.getByTestId('selected-section')).toHaveText('First');

  await page.getByRole('button', { name: 'External edit of B' }).click();
  await page.getByTestId('panel-edit').click();

  await expect(page.getByTestId('source')).toContainText('A panel');
  await expect(page.getByTestId('source')).toContainText('B external');

  await page.getByRole('button', { name: 'Editor mode' }).click();
  const editor = page.getByTestId('raw-editor');
  await expect(editor).toHaveValue(/A panel[\s\S]*B external/);
  await editor.fill((await editor.inputValue()).replace('A panel', 'A editor'));
  await page.getByRole('button', { name: 'DnD mode' }).click();

  await expect(page.getByTestId('source')).toContainText('A editor');
  await expect(page.getByTestId('source')).toContainText('B external');
  await expect(page.locator('[aria-roledescription="sortable"]')).toHaveCount(
    2,
  );
});
