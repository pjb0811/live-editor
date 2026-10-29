// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { clearCompilationCache } from '~/utils';

import { PreviewContext } from '../../context/states';
import Dnd from '../dnd';
import { Canvas } from '../layout';

// The frame's iframe/shadow plumbing isn't under test: render sections inline.
vi.mock('~/components/frame', () => ({
  default: ({
    children,
  }: {
    children: (container: HTMLElement) => React.ReactNode;
  }) => <>{children(document.body)}</>,
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  clearCompilationCache();
});

// A document whose `App` keeps a click count in state, with one section
// whose title is `title`. `extraHook` adds a second hook call.
const documentWith = (title: string, extraHook = false) => `
import { useState } from 'react';

const App = () => {
  const [count, setCount] = useState(0);
  ${extraHook ? 'const [other] = useState(1);' : ''}

  return (
    <main id="app-container">
      <section data-id="s" data-name="S">
        <h1 data-id="t">${title}</h1>
        <button type="button" onClick={() => setCount(count + 1)}>
          clicked {count}
        </button>
      </section>
    </main>
  );
};

export default App;
`;

const tree = (value: string) => (
  <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
    <Dnd value={value} onChange={vi.fn()}>
      <Canvas />
    </Dnd>
  </PreviewContext.Provider>
);

// Each edit recompiles a section into a new component function. Rendered
// as is, the new function is a new component type, and React rebuilt the
// section's whole DOM and dropped its state on every edit.
describe('an edited canvas section', () => {
  it('keeps its DOM and state when an edit changes only values', () => {
    const { rerender } = render(tree(documentWith('Hello')));
    const heading = screen.getByRole('heading', { name: 'Hello' });

    fireEvent.click(screen.getByRole('button', { name: 'clicked 0' }));

    act(() => rerender(tree(documentWith('World'))));

    expect(heading.isConnected).toBe(true);
    expect(heading.textContent).toBe('World');
    expect(screen.getByRole('button', { name: 'clicked 1' })).not.toBeNull();
  });

  it('remounts when an edit changes its hook calls', () => {
    const { rerender } = render(tree(documentWith('Hello')));
    const heading = screen.getByRole('heading', { name: 'Hello' });

    fireEvent.click(screen.getByRole('button', { name: 'clicked 0' }));

    act(() => rerender(tree(documentWith('Hello', true))));

    expect(heading.isConnected).toBe(false);
    expect(screen.getByRole('button', { name: 'clicked 0' })).not.toBeNull();
  });
});
