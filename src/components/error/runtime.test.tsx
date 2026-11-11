// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it.each([
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
  ])('ignores the browser notice %j (#714)', message => {
    render(
      <ContextProvider>
        <Runtime />
        <ErrorProbe />
      </ContextProvider>,
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message }));
    });

    expect(screen.getByRole('status').textContent).toBe('none');
  });

  it('leaves the event to the browser (#714)', () => {
    render(
      <ContextProvider>
        <Runtime />
      </ContextProvider>,
    );

    const event = new ErrorEvent('error', {
      message: 'boom',
      cancelable: true,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });

  it('offers Try Again when given reset (#714)', () => {
    const reset = vi.fn();

    render(
      <ContextProvider>
        <Runtime reset={reset} />
      </ContextProvider>,
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    });
    fireEvent.click(screen.getByText('Try Again'));

    expect(reset).toHaveBeenCalledOnce();
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
