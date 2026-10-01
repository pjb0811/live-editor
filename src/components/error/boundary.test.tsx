// @vitest-environment jsdom
import { useEffect } from 'react';

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ErrorBoundary from './boundary';

const Child = ({ fail }: { fail: boolean }) => {
  if (fail) {
    throw new Error('boom');
  }

  return <p>ok</p>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // Clearing the error in componentDidUpdate let the fallback render once
  // more with the new keys before `children` got their turn (#442).
  it('renders children, not the fallback, in the render that sees new resetKeys', () => {
    const renders: string[] = [];
    const effects: string[] = [];

    const Fallback = ({ k }: { k: string }) => {
      renders.push(k);
      useEffect(() => {
        effects.push(k);
      }, [k]);

      return <p>fallback</p>;
    };

    const view = (k: string, fail: boolean) => (
      <ErrorBoundary fallback={() => <Fallback k={k} />} resetKeys={[k]}>
        <Child fail={fail} />
      </ErrorBoundary>
    );

    const { rerender } = render(view('a', true));

    expect(screen.getByText('fallback')).toBeTruthy();

    renders.length = 0;
    rerender(view('b', false));

    expect(screen.getByText('ok')).toBeTruthy();
    expect(renders).toEqual([]);
    expect(effects).toEqual(['a']);
  });

  it('catches a throw with the new resetKeys fresh', () => {
    const view = (k: string) => (
      <ErrorBoundary fallback={message => <p>{message}</p>} resetKeys={[k]}>
        <Child fail />
      </ErrorBoundary>
    );

    const { rerender } = render(view('a'));
    const onError = vi.fn();

    expect(screen.getByText('boom')).toBeTruthy();

    rerender(
      <ErrorBoundary
        fallback={message => <p>{message}</p>}
        onError={onError}
        resetKeys={['b']}
      >
        <Child fail />
      </ErrorBoundary>,
    );

    expect(screen.getByText('boom')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('keeps the error while resetKeys stay the same', () => {
    const view = (fail: boolean) => (
      <ErrorBoundary fallback={() => <p>fallback</p>} resetKeys={['a']}>
        <Child fail={fail} />
      </ErrorBoundary>
    );

    const { rerender } = render(view(true));

    rerender(view(false));

    expect(screen.getByText('fallback')).toBeTruthy();
  });

  it('does not reset a later error because of a key change made while healthy', () => {
    const view = (k: string, fail: boolean) => (
      <ErrorBoundary fallback={() => <p>fallback</p>} resetKeys={[k]}>
        <Child fail={fail} />
      </ErrorBoundary>
    );

    const { rerender } = render(view('a', false));

    rerender(view('b', false));
    rerender(view('b', true));
    rerender(view('b', false));

    expect(screen.getByText('fallback')).toBeTruthy();
  });

  it('recovers through the fallback reset', () => {
    let reset: (() => void) | undefined;
    let fail = true;

    const Flaky = () => {
      if (fail) {
        throw new Error('boom');
      }

      return <p>ok</p>;
    };

    render(
      <ErrorBoundary
        fallback={(_, onReset) => {
          reset = onReset;

          return <p>fallback</p>;
        }}
      >
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback')).toBeTruthy();

    fail = false;
    act(() => reset?.());

    expect(screen.getByText('ok')).toBeTruthy();
  });
});
