// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Guard from './guard';

// What a section's event handler throwing looks like to the page.
const throwFromHandler = (message: string) => {
  window.dispatchEvent(
    new ErrorEvent('error', { error: new Error(message), message }),
  );
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Guard', () => {
  it('replaces its children with the error a handler threw, and reports it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <Guard onError={onError}>
        <p>content</p>
      </Guard>,
    );

    act(() => throwFromHandler('handler broke'));

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('Runtime Error')).toBeTruthy();
    expect(screen.getByText('handler broke')).toBeTruthy();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0]![0].message).toBe('handler broke');
  });

  it('shows the children again after Try Again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Guard>
        <p>content</p>
      </Guard>,
    );

    act(() => throwFromHandler('handler broke'));
    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByText('content')).toBeTruthy();
  });

  it('reports an unhandled rejection with its reason', () => {
    const onError = vi.fn();

    render(
      <Guard onError={onError}>
        <p>content</p>
      </Guard>,
    );

    const reason = new Error('request failed');
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;

    Object.assign(event, { reason, promise: Promise.resolve() });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(screen.getByText('request failed')).toBeTruthy();
    expect(onError).toHaveBeenCalledWith(reason);
  });

  it('reports one error per burst, then listens again', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <Guard onError={onError}>
        <p>content</p>
      </Guard>,
    );

    act(() => {
      throwFromHandler('first');
      throwFromHandler('second');
    });
    expect(onError).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(100);
      throwFromHandler('third');
    });
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
