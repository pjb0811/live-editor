// @vitest-environment jsdom
import { useEffect } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
