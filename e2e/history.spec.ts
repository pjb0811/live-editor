import { expect, test } from '@playwright/test';

// The code editor's own undo history, followed by a panel edit in DnD: the
// panel has to build on the undone document, not on the text that was undone.
test('a panel edit builds on the code editor after an undo', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=history');

  const source = page.getByTestId('source');

  await expect(page.locator('.cm-editor')).toHaveCount(1);

  const end = await page.evaluate(() => {
    const snapshot = window.browserTestEditor.read('B title')!;

    return snapshot.document.indexOf('B title') + 'B title'.length;
  });

  await page.evaluate(
    position => window.browserTestEditor.focusAt('B title', position),
    end,
  );
  await page.keyboard.type(' typed');
  await expect(source).toContainText('B title typed');

  await page.keyboard.press('ControlOrMeta+z');
  await expect(source).not.toContainText('typed');

  // Typing after an undo discards the redo branch and commits as usual.
  await page.keyboard.type(' kept');
  await expect(source).toContainText('B title kept');

  await page.getByRole('button', { name: 'DnD mode' }).click();
  await page.locator('[aria-roledescription="sortable"]').first().click();
  await expect(page.getByTestId('selected-section')).toHaveText('First');
  await page.getByTestId('panel-edit').click();

  await expect(source).toContainText('A panel');
  await expect(source).toContainText('B title kept');
  await expect(source).not.toContainText('typed');
});
