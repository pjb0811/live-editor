// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { showErrorToast } from './toast';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const alerts = () => [...document.querySelectorAll('[role="alert"]')];

describe('showErrorToast', () => {
  it('shows the title and description as an alert', () => {
    showErrorToast('Cannot remove "Title"', 'It is marked required.');

    expect(alerts().map(alert => alert.textContent)).toEqual([
      'Cannot remove "Title"It is marked required.',
    ]);
  });

  it('stacks toasts in one region', () => {
    showErrorToast('First');
    showErrorToast('Second');

    expect(alerts()).toHaveLength(2);
    expect(alerts()[0]!.parentElement).toBe(alerts()[1]!.parentElement);
  });

  it('goes away on its own, or early on a click', () => {
    vi.useFakeTimers();

    showErrorToast('Timed');
    showErrorToast('Clicked');

    (alerts()[1] as HTMLElement).click();

    expect(alerts().map(alert => alert.textContent)).toEqual(['Timed']);

    vi.advanceTimersByTime(6000);

    expect(alerts()).toHaveLength(0);
  });
});
