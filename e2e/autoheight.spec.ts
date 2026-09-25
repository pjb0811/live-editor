import type { Frame, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// Section order in the fixture's `autoHeightCode`.
const STATIC = 0;
const FADE = 1;
const FADE_FLOW = 2;
const CLOSED = 3;
const FADING_OUT = 4;
const WAAPI = 5;

const FIXED_HEIGHT = 400;
const CLOSED_FLOW_HEIGHT = 60;

const readHeights = (page: Page) =>
  page.$$eval('iframe', frames =>
    frames.map(frame => Math.round(frame.getBoundingClientRect().height)),
  );

const previewFrames = (page: Page): Frame[] =>
  page.frames().filter(frame => frame !== page.mainFrame());

const finishAnimations = (page: Page) =>
  Promise.all(
    previewFrames(page).map(frame =>
      frame.evaluate(() => {
        document.getAnimations().forEach(animation => animation.finish());
      }),
    ),
  );

test.describe('autoHeight with animated content (#374)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/fixture.html?scenario=autoheight');
    await expect(page.locator('iframe')).toHaveCount(6);
  });

  test('measures a fixed element that is still fading in', async ({ page }) => {
    // Both fade-in sections sit at computed `opacity: 0` with a running
    // animation. Before the fix the walk skipped them: the section with no
    // flow content got no height written at all (the browser's 150px iframe
    // default), and the one with 40px of flow content was clipped to it.
    await expect
      .poll(async () => (await readHeights(page))[FADE])
      .toBe(FIXED_HEIGHT);
    await expect
      .poll(async () => (await readHeights(page))[FADE_FLOW])
      .toBe(FIXED_HEIGHT);

    // The control: identical element, no animation, correct all along.
    expect((await readHeights(page))[STATIC]).toBe(FIXED_HEIGHT);
  });

  test('re-measures when a CSS animation ends, with no other DOM change', async ({
    page,
  }) => {
    // Fading *out* with `animation-fill-mode: forwards`. Mid-animation the
    // element is genuinely visible, so it belongs in the height.
    await expect
      .poll(async () => (await readHeights(page))[FADING_OUT])
      .toBe(FIXED_HEIGHT);

    await finishAnimations(page);

    // Now finished and holding `opacity: 0` — hidden for good, so the section
    // falls back to its flow content. Nothing but the animation ending has
    // happened, which is precisely what used to leave the height stale.
    await expect
      .poll(async () => (await readHeights(page))[FADING_OUT])
      .toBe(CLOSED_FLOW_HEIGHT);

    // The fade-ins settle at the same height they were already measured at.
    const settled = await readHeights(page);

    expect(settled[FADE]).toBe(FIXED_HEIGHT);
    expect(settled[FADE_FLOW]).toBe(FIXED_HEIGHT);
  });

  test('re-measures when a script-driven animation finishes', async ({
    page,
  }) => {
    // The Web Animations API fires no DOM event when an animation ends, so
    // this section is covered by its `finished` promise instead. The section
    // starts its animation from an effect on mount, a beat after the mutation
    // that triggers the first measurement pass — so nothing here forces an
    // extra pass, and the animation has to be picked up by the follow-up look
    // each pass books for itself.
    //
    // Part-way through a 30s growth from 0 to 400px, so whatever it reads now
    // it is not the settled height.
    expect((await readHeights(page))[WAAPI]).toBeLessThan(FIXED_HEIGHT);

    await finishAnimations(page);

    await expect
      .poll(async () => (await readHeights(page))[WAAPI])
      .toBe(FIXED_HEIGHT);
  });

  test('still excludes an overlay that is hidden for good', async ({
    page,
  }) => {
    // `opacity: 0` with no animation at all: a closed bottom sheet, which
    // must not inflate the section by the height it would have if shown.
    await expect
      .poll(async () => (await readHeights(page))[CLOSED])
      .toBe(CLOSED_FLOW_HEIGHT);

    await finishAnimations(page);

    await expect
      .poll(async () => (await readHeights(page))[CLOSED])
      .toBe(CLOSED_FLOW_HEIGHT);
  });
});
