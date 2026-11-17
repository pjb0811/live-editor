import { expect, test } from '@playwright/test';

// Each canvas section mounts once, in every frame mode (#773). The fixture
// page renders under React StrictMode, which mounts, unmounts and mounts
// each component once more in development, so one mount reads as
// mount, unmount, mount.
const ONCE = (id: string) => [`mount ${id}`, `unmount ${id}`, `mount ${id}`];

for (const mode of ['in place', 'iframe', 'shadow'] as const) {
  test(`${mode}: each section mounts once`, async ({ page }) => {
    const query = mode === 'in place' ? '' : `&mode=${mode}`;

    await page.goto(`/e2e/fixture.html?scenario=mounts${query}`);
    await expect(page.locator('[aria-roledescription="sortable"]')).toHaveCount(
      2,
    );

    const log = () =>
      page.evaluate(() =>
        (window as unknown as { mountLog: string[] }).mountLog.slice(),
      );

    await expect
      .poll(async () => (await log()).filter(entry => entry.endsWith('one')))
      .toEqual(ONCE('one'));
    // Settled: nothing more after a while.
    await page.waitForTimeout(1000);

    const entries = await log();

    expect(entries.filter(entry => entry.endsWith('one'))).toEqual(ONCE('one'));
    expect(entries.filter(entry => entry.endsWith('two'))).toEqual(ONCE('two'));
  });
}
