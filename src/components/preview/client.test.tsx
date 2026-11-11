// @vitest-environment jsdom
import { useEffect } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ContextProvider from '~/components/context/context';
import { useError, usePreview } from '~/components/context/states';

import Preview from './preview';

// Puts `code` in the preview context, the way the code editor does.
const SetContextCode = ({ code }: { code: string }) => {
  const { setCode } = usePreview();

  useEffect(() => setCode(code), [code, setCode]);

  return null;
};

const ErrorProbe = () => <output>{useError().error ?? 'none'}</output>;

const component = (text: string) =>
  `export default function App() { return <p>${text}</p>; }`;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Preview', () => {
  it('renders the context code when no code is passed', () => {
    render(
      <ContextProvider>
        <SetContextCode code={component('from context')} />
        <Preview />
      </ContextProvider>,
    );

    expect(screen.getByText('from context')).toBeTruthy();
  });

  it('renders its own code over the context, and nothing for an empty string', () => {
    const view = render(
      <ContextProvider>
        <SetContextCode code={component('from context')} />
        <Preview code={component('from prop')} />
      </ContextProvider>,
    );

    expect(screen.getByText('from prop')).toBeTruthy();
    expect(screen.queryByText('from context')).toBeNull();

    view.rerender(
      <ContextProvider>
        <SetContextCode code={component('from context')} />
        <Preview code="" />
      </ContextProvider>,
    );

    expect(screen.queryByText('from context')).toBeNull();
  });

  it('shows a compile error instead of the component', () => {
    render(
      <ContextProvider>
        <Preview code="export default () => <p>" />
      </ContextProvider>,
    );

    expect(screen.getByText('Compile Error')).toBeTruthy();
  });

  it('reports a component that throws while rendering to the error context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ContextProvider>
        <Preview
          showError
          code="export default () => { throw new Error('render broke'); }"
        />
        <ErrorProbe />
      </ContextProvider>,
    );

    expect(screen.getByRole('status').textContent).toBe('render broke');
    expect(screen.getByText('Runtime Error')).toBeTruthy();
  });

  it('wraps the component in `provider`', () => {
    render(
      <ContextProvider>
        <Preview
          code={component('inside')}
          provider={children => <section aria-label="host">{children}</section>}
        />
      </ContextProvider>,
    );

    expect(screen.getByRole('region', { name: 'host' }).textContent).toContain(
      'inside',
    );
  });
});

// A component with a click count in state and a heading of `title`.
// `extraHook` adds a second hook call.
const counter = (title: string, extraHook = false) => `
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  ${extraHook ? 'const [other] = useState(1);' : ''}

  return (
    <>
      <h1>${title}</h1>
      <button type="button" onClick={() => setCount(count + 1)}>
        clicked {count}
      </button>
    </>
  );
}
`;

// Each edit compiles a new component function. Rendered as is, it is a new
// component type, and React rebuilt the preview's DOM and dropped its state
// on every keystroke.
describe('an edited preview', () => {
  const preview = (code: string) => (
    <ContextProvider>
      <Preview code={code} />
    </ContextProvider>
  );

  it('keeps its DOM and state when an edit leaves the hooks alone', () => {
    const view = render(preview(counter('Hello')));
    const heading = screen.getByRole('heading', { name: 'Hello' });

    fireEvent.click(screen.getByRole('button', { name: 'clicked 0' }));
    view.rerender(preview(counter('World')));

    expect(heading.isConnected).toBe(true);
    expect(heading.textContent).toBe('World');
    expect(screen.getByRole('button', { name: 'clicked 1' })).toBeTruthy();
  });

  it('remounts when an edit changes the hook calls', () => {
    const view = render(preview(counter('Hello')));
    const heading = screen.getByRole('heading', { name: 'Hello' });

    fireEvent.click(screen.getByRole('button', { name: 'clicked 0' }));
    view.rerender(preview(counter('Hello', true)));

    expect(heading.isConnected).toBe(false);
    expect(screen.getByRole('button', { name: 'clicked 0' })).toBeTruthy();
  });
});

// Page errors reach the preview through two `window` listeners, which can't
// tell where an error came from (#714). Each case passes `code` as a prop,
// which never goes through the provider's `setCode`.
describe('a page error', () => {
  const pageError = (message: string) =>
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message }));
    });

  const preview = (code: string, showError = true) => (
    <ContextProvider>
      <Preview code={code} showError={showError} />
      <ErrorProbe />
    </ContextProvider>
  );

  // `showError` hides the preview's wrapper while the context has an error.
  const isShown = (element: HTMLElement) =>
    !element.closest('[class*="hidden"]');

  it.each([false, true])(
    'keeps the preview mounted with its state (showError: %s)',
    showError => {
      render(preview(counter('Hello'), showError));
      fireEvent.click(screen.getByRole('button', { name: 'clicked 0' }));
      pageError('host-app-error');

      expect(screen.getByRole('button', { name: 'clicked 1' })).toBeTruthy();
    },
  );

  it('shows the preview again after Try Again with showError', () => {
    render(preview(counter('Hello')));
    fireEvent.click(screen.getByRole('button', { name: 'clicked 0' }));
    pageError('host-app-error');

    const button = screen.getByRole('button', { name: 'clicked 1' });

    expect(isShown(button)).toBe(false);

    // One box from `Guard` and one from `Runtime`; either clears its own.
    for (const tryAgain of screen.getAllByText('Try Again')) {
      fireEvent.click(tryAgain);
    }

    expect(isShown(button)).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('none');
  });

  it('ignores the browser ResizeObserver notice', () => {
    render(preview(counter('Hello')));
    pageError('ResizeObserver loop completed with undelivered notifications.');

    expect(screen.queryByText('Runtime Error')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('none');
  });
});

describe('a render error with code passed as a prop', () => {
  const preview = (code: string) => (
    <ContextProvider>
      <Preview code={code} showError />
      <ErrorProbe />
    </ContextProvider>
  );

  const throwing = (message: string) =>
    `export default () => { throw new Error('${message}'); }`;

  it('goes away when the code is fixed (#714)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const view = render(preview(throwing('render broke')));

    expect(screen.getByRole('status').textContent).toBe('render broke');

    view.rerender(preview(component('fixed')));

    const fixed = screen.getByText('fixed');

    expect(fixed.closest('[class*="hidden"]')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('none');
  });

  it("is replaced by the new code's own render error", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const view = render(preview(throwing('first')));

    view.rerender(preview(throwing('second')));

    expect(screen.getByRole('status').textContent).toBe('second');
  });
});

describe('an event handler error in the previewed code', () => {
  it('reaches the error context', () => {
    render(
      <ContextProvider>
        <Preview code={component('ok')} />
        <ErrorProbe />
      </ContextProvider>,
    );

    act(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('handler broke'),
          message: 'handler broke',
        }),
      );
    });

    expect(screen.getByRole('status').textContent).toBe('handler broke');
    expect(screen.getByText('ok')).toBeTruthy();
  });
});
