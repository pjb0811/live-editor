import type { Frame, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const FIXED_HEIGHT = 400;
const FLOW_HEIGHT = 60;

const previewFrame = (page: Page): Frame => {
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());

  if (!frame) {
    throw new Error('The preview iframe was not found');
  }

  return frame;
};

const iframeHeight = (page: Page) =>
  page.$eval('iframe', frame =>
    Math.round(frame.getBoundingClientRect().height),
  );

const overlayOpacity = (page: Page) =>
  previewFrame(page).evaluate(() =>
    Number(
      getComputedStyle(document.getElementById('overlay')!).opacity || '0',
    ),
  );

// Writing an inline style is both what starts the transition and the DOM
// mutation that makes the MutationObserver schedule a measurement pass — the
// two land together, which is exactly the collision that used to kill the
// transition.
const setOverlayOpacity = (page: Page, opacity: string) =>
  previewFrame(page).evaluate(value => {
    document.getElementById('overlay')!.style.opacity = value;
  }, opacity);

// Completing a transition is neither a DOM mutation nor a resize, which is
// the whole point: only a transitionend listener can notice it.
const finishTransitions = (page: Page) =>
  previewFrame(page).evaluate(() => {
    document.getAnimations().forEach(animation => animation.finish());
  });

test.describe('autoHeight leaves the preview its transitions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/fixture.html?scenario=transitions');

    // The overlay starts at `opacity: 0` with nothing running, so it is
    // excluded and the section is its flow content. Waiting for that also
    // settles the probe height, which is what decides whether the next pass
    // freezes transitions.
    await expect.poll(() => iframeHeight(page)).toBe(FLOW_HEIGHT);
  });

  test('a fade-in triggered by a DOM change actually animates', async ({
    page,
  }) => {
    await setOverlayOpacity(page, '1');

    // Part-way through a 5s fade. Before the fix the measurement pass
    // cancelled the transition, so this read `1` — the overlay appeared
    // instantly instead of fading.
    await page.waitForTimeout(600);

    const midOpacity = await overlayOpacity(page);

    expect(midOpacity).toBeGreaterThan(0);
    expect(midOpacity).toBeLessThan(1);

    // And it is measured from the first pass, when the computed opacity is
    // still exactly 0 and only the running transition says otherwise.
    expect(await iframeHeight(page)).toBe(FIXED_HEIGHT);
  });

  test('a finished fade-out re-measures without any other DOM change', async ({
    page,
  }) => {
    await setOverlayOpacity(page, '1');
    await finishTransitions(page);
    await expect.poll(() => overlayOpacity(page)).toBe(1);
    expect(await iframeHeight(page)).toBe(FIXED_HEIGHT);

    await setOverlayOpacity(page, '0');

    // Still visible while fading out, so it stays in the height.
    await page.waitForTimeout(600);
    expect(await overlayOpacity(page)).toBeLessThan(1);
    expect(await iframeHeight(page)).toBe(FIXED_HEIGHT);

    await finishTransitions(page);

    // Now `opacity: 0` with nothing running — hidden for good, so the section
    // falls back to its flow content.
    await expect.poll(() => iframeHeight(page)).toBe(FLOW_HEIGHT);
  });
});
