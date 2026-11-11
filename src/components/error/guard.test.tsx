// @vitest-environment jsdom
import { useState } from 'react';

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
  // The listener can't tell where an error came from, so the box goes next
  // to the children instead of unmounting them (#714).
  it('shows the error a handler threw next to its children, and reports it', () => {
    const onError = vi.fn();

    render(
      <Guard onError={onError}>
        <p>content</p>
      </Guard>,
    );

    act(() => throwFromHandler('handler broke'));

    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByText('Runtime Error')).toBeTruthy();
    expect(screen.getByText('handler broke')).toBeTruthy();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0]![0].message).toBe('handler broke');
  });

  it('keeps the state of its children across an error and Try Again', () => {
    const Counter = () => {
      const [count, setCount] = useState(0);

      return (
        <button type="button" onClick={() => setCount(count + 1)}>
          clicked {count}
        </button>
      );
    };

    render(
      <Guard>
        <Counter />
      </Guard>,
    );

    fireEvent.click(screen.getByText('clicked 0'));
    act(() => throwFromHandler('handler broke'));

    expect(screen.getByText('clicked 1')).toBeTruthy();

    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.queryByText('Runtime Error')).toBeNull();
    expect(screen.getByText('clicked 1')).toBeTruthy();
  });

  it.each([
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
  ])('ignores the browser notice %j', message => {
    vi.useFakeTimers();
    const onError = vi.fn();

    render(
      <Guard onError={onError}>
        <p>content</p>
      </Guard>,
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message }));
    });

    expect(screen.queryByText('Runtime Error')).toBeNull();
    expect(onError).not.toHaveBeenCalled();

    // Right after, inside the 100 ms window: a real error is still reported.
    act(() => throwFromHandler('real'));

    expect(onError).toHaveBeenCalledOnce();
  });

  // The browser then still reports the error in the console, with its stack.
  it('leaves the event to the browser and logs nothing itself', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <Guard>
        <p>content</p>
      </Guard>,
    );

    const event = new ErrorEvent('error', {
      error: new Error('handler broke'),
      message: 'handler broke',
      cancelable: true,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('leaves an unhandled rejection to the browser', () => {
    render(
      <Guard>
        <p>content</p>
      </Guard>,
    );

    const event = new Event('unhandledrejection', {
      cancelable: true,
    }) as PromiseRejectionEvent;

    Object.assign(event, {
      reason: new Error('request failed'),
      promise: Promise.resolve(),
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
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
