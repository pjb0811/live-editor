// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ContextProvider from '~/components/context/context';
import { useError } from '~/components/context/states';

import Runtime from './runtime';

// Shows the context's error outside `Runtime`, to see what it leaves behind.
const ErrorProbe = () => <output>{useError().error ?? 'none'}</output>;

afterEach(cleanup);

describe('Runtime', () => {
  it('shows a page error and stores it in the error context', () => {
    render(
      <ContextProvider>
        <Runtime />
        <ErrorProbe />
      </ContextProvider>,
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    });

    expect(screen.getByText('Runtime Error')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('boom');
  });

  it('renders nothing while closed, but still records the error', () => {
    render(
      <ContextProvider>
        <Runtime open={false} />
        <ErrorProbe />
      </ContextProvider>,
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    });

    expect(screen.queryByText('Runtime Error')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('boom');
  });

  it('clears the error when it unmounts', () => {
    const view = render(
      <ContextProvider>
        <Runtime />
        <ErrorProbe />
      </ContextProvider>,
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    });
    view.rerender(
      <ContextProvider>
        <ErrorProbe />
      </ContextProvider>,
    );

    expect(screen.getByRole('status').textContent).toBe('none');
  });

  it('applies the div props to its box (#721)', () => {
    const { container } = render(
      <ContextProvider>
        <Runtime id="runtime" data-testid="rt" />
      </ContextProvider>,
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    });

    const box = container.querySelector<HTMLElement>('#runtime')!;

    expect(box.dataset.testid).toBe('rt');
    expect(box.textContent).toContain('boom');
  });
});
