import { expect, test } from '@playwright/test';

// What a handler in one canvas section can change in another (#743). Each
// section runs the document on its own, so only state outside it is shared.
test('a canvas section shares a modules store, not App or provider state', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=cross-section');

  const button = page.getByTestId('increment');

  await expect(button).toBeVisible();

  // The section shield takes the pointer, so a click never reaches the
  // content (see the next test). Dispatched to reach the handler anyway.
  await button.dispatchEvent('click');

  await expect(page.getByTestId('counts-1')).toHaveText(
    'app=1 store=1 provider=1',
  );
  await expect(page.getByTestId('counts-2')).toHaveText(
    'app=0 store=1 provider=0',
  );
});

test('a click on the canvas selects the section instead of running its handler', async ({
  page,
}) => {
  await page.goto('/e2e/fixture.html?scenario=cross-section');

  const button = page.getByTestId('increment');
  const box = await button.boundingBox();

  expect(box).not.toBeNull();

  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect(page.getByTestId('counts-1')).toHaveText(
    'app=0 store=0 provider=0',
  );
});
