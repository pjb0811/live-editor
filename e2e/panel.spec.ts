import { expect, test } from '@playwright/test';

test('keyboard Space and Shift+Space select an item range', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=selection');

  // The rows only: "Select all" (#638) is the one checkbox with a name.
  const selectAll = page.getByRole('checkbox', { name: 'Select all' });
  const checkboxes = page.getByRole('checkbox', { name: /^$/ });

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

  await expect(selectAll).toBeChecked();
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

test('a validation error keeps the declared field spacing without a preflight', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=field-error');

  const next = page.getByRole('textbox').nth(1);
  const topBefore = await next.evaluate(el => el.getBoundingClientRect().top);

  const link = page.getByRole('textbox').first();

  await link.fill('not a url');
  await link.blur();

  const error = page.getByRole('alert');

  await expect(error).toBeVisible();
  await expect(error).toHaveCSS('margin-bottom', '0px');

  // The error's own height (plus its top margin) is the only shift allowed —
  // no UA bottom margin collapsing into the gap before the next field.
  const errorBox = await error.evaluate(el => {
    const rect = el.getBoundingClientRect();

    return rect.height + parseFloat(getComputedStyle(el).marginTop);
  });
  const topAfter = await next.evaluate(el => el.getBoundingClientRect().top);

  expect(topAfter - topBefore).toBeCloseTo(errorBox, 0);
});

test('the source editor saves on blur and refuses markup that does not parse', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=source-field');

  const source = page.getByTestId('source');
  const body = page.locator('[data-node-id="html"] .cm-content');
  const text = page.locator('[data-node-id="txt"] textarea');

  await page
    .locator('section[data-id="s1"]')
    .first()
    .click({
      position: { x: 5, y: 5 },
    });
  await expect(body).toBeVisible();

  // insertText, so the editor's tag auto-closing doesn't add to the value.
  await body.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('<i>new</i>');
  await text.click();

  await expect(source).toContainText('<div data-id="html"');
  await expect(source).toContainText('><i>new</i></div>');

  await body.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('a > b');
  await text.click();

  await expect(page.getByText('Failed to update "Body"')).toBeVisible();
  await expect(source).toContainText('><i>new</i></div>');
  await expect(source).not.toContainText('a > b');

  // The document still parses, so other fields still edit.
  await text.fill('changed');
  await text.blur();

  await expect(source).toContainText('>changed</p>');
});
