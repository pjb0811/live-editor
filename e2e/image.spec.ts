import { expect, test } from '@playwright/test';

// A 1×1 PNG.
const PNG = new URL('./assets/pixel.png', import.meta.url).pathname;

// `type: 'image'` with `onUpload` (#752), through the real file chooser.
test('an image field uploads a chosen file and previews it', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=image-field');

  await page
    .locator('[aria-roledescription="sortable"]')
    .first()
    .click({ position: { x: 5, y: 5 } });

  const field = page.locator('[data-node-id="hero"]');
  const input = field.getByRole('textbox');
  const thumbnail = field.locator('img');

  // `/missing.png` doesn't load, so there is no thumbnail.
  await expect(input).toHaveValue('/missing.png');
  await expect(thumbnail).toHaveCount(0);

  const chooser = page.waitForEvent('filechooser');

  await field.getByRole('button', { name: 'Choose image' }).click();
  await (await chooser).setFiles(PNG);

  await expect(page.getByTestId('source')).toContainText(
    'src="data:image/png;base64,',
  );
  await expect(thumbnail).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect
    .poll(() =>
      thumbnail.evaluate(img => (img as HTMLImageElement).naturalWidth),
    )
    .toBe(1);

  // A rejected upload reports and keeps the value.
  await page.getByRole('button', { name: 'Reject uploads' }).click();

  const before = await page.getByTestId('source').textContent();
  const second = page.waitForEvent('filechooser');

  await field.getByRole('button', { name: 'Choose image' }).click();
  await (await second).setFiles(PNG);

  await expect(
    page.getByText('Failed to upload an image for "Image"'),
  ).toBeVisible();
  await expect(page.getByTestId('source')).toHaveText(before!);
});
