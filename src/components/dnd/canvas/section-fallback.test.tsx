// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TEMPLATE } from '~/constants';
import { clearCompilationCache } from '~/utils';

import { PreviewContext } from '../../context/states';
import Dnd from '../dnd';
import { Canvas } from '../layout';
import Renderer from './renderer';
import {
  type DndRenderSectionFallback,
  SectionFallbackContext,
} from './section-fallback-context';

// The frame's iframe/shadow plumbing isn't under test: render the section
// inline so jsdom can see what it produced.
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
  vi.restoreAllMocks();
  delete (globalThis as { topLevelRan?: boolean }).topLevelRan;
});

const working = `const App = () => <p>fine</p>;\nexport default App;`;
const broken = `const App = () => <p>;\nexport default App;`;
const throwing = `const App = () => { throw new Error('boom'); };\nexport default App;`;
// Top-level code that records it ran, so a test can tell whether the
// section was compiled and evaluated at all.
const sideEffect = `globalThis.topLevelRan = true;\nconst App = () => <p>ran</p>;\nexport default App;`;

const withFallback = (
  renderFallback: DndRenderSectionFallback | undefined,
  node: React.ReactNode,
) => (
  <SectionFallbackContext.Provider value={renderFallback}>
    {node}
  </SectionFallbackContext.Provider>
);

const section = {
  sectionId: 'hero',
  sectionName: 'Hero',
  sectionCode: '<x />',
};

describe('Renderer fallbacks', () => {
  it('renders the consumer fallback for a compile error', () => {
    const renderFallback = vi.fn<DndRenderSectionFallback>(({ reason }) => (
      <p>custom {reason}</p>
    ));

    render(
      withFallback(renderFallback, <Renderer preview={broken} {...section} />),
    );

    expect(screen.getByText('custom compile')).not.toBeNull();
    expect(renderFallback).toHaveBeenCalledWith({
      section: { id: 'hero', name: 'Hero', code: '<x />' },
      reason: 'compile',
      message: expect.any(String),
    });
  });

  it('renders the consumer fallback for a render error and recovers when fixed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const tree = (preview: string) =>
      withFallback(
        ({ reason, message }) => (
          <p>
            custom {reason}: {message}
          </p>
        ),
        <Renderer preview={preview} {...section} />,
      );
    const { rerender } = render(tree(throwing));

    expect(screen.getByText('custom runtime: boom')).not.toBeNull();

    // A new preview string is the recovery signal, with no remount.
    rerender(tree(working));

    expect(screen.getByText('fine')).not.toBeNull();
  });

  it('skips compiling a forced section and renders the fallback', () => {
    render(
      withFallback(
        ({ reason, message }) => (
          <p>
            custom {reason} {String(message)}
          </p>
        ),
        <Renderer preview={sideEffect} {...section} forceFallback />,
      ),
    );

    expect(screen.getByText('custom forced undefined')).not.toBeNull();
    expect(
      (globalThis as { topLevelRan?: boolean }).topLevelRan,
    ).toBeUndefined();
  });

  it('keeps the built-in error when the fallback returns undefined', () => {
    render(withFallback(() => undefined, <Renderer preview={broken} />));

    expect(screen.getByText('Compile Error')).not.toBeNull();
  });

  it('keeps the built-in error when the fallback itself throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      withFallback(
        () => {
          throw new Error('fallback broke');
        },
        <Renderer preview={broken} />,
      ),
    );

    expect(screen.getByText('Compile Error')).not.toBeNull();
  });

  it('shows the built-in errors when no fallback is provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Renderer preview={broken} />);
    expect(screen.getByText('Compile Error')).not.toBeNull();

    cleanup();

    render(<Renderer preview={throwing} />);
    expect(screen.getByText('Rendering Error')).not.toBeNull();

    cleanup();

    render(<Renderer preview={sideEffect} forceFallback />);
    expect(screen.getByText('Section Unavailable')).not.toBeNull();
  });
});

const documentWith = (...sections: string[]) =>
  DEFAULT_TEMPLATE.replace(
    '<main id="app-container"></main>',
    `<main id="app-container">${sections.join('')}</main>`,
  );

const sectionCode = (id: string, name: string, body: string) =>
  `<section data-id="${id}" data-name="${name}">${body}</section>`;

const renderDnd = (props: React.ComponentProps<typeof Dnd>) =>
  render(
    <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
      <Dnd onChange={vi.fn()} {...props}>
        <Canvas />
      </Dnd>
    </PreviewContext.Provider>,
  );

describe('Live.Dnd section fallback props', () => {
  it('passes the failing section to renderSectionFallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const renderSectionFallback = vi.fn<DndRenderSectionFallback>(
      ({ section: failed, reason }) => (
        <p>
          {failed.name} {reason}
        </p>
      ),
    );

    renderDnd({
      value: documentWith(
        sectionCode('ok', 'Fine', '<p>fine</p>'),
        sectionCode('bad', 'Broken', '{missingValue}'),
      ),
      renderSectionFallback,
    });

    expect(screen.getByText('fine')).not.toBeNull();
    expect(screen.getByText('Broken runtime')).not.toBeNull();
    expect(renderSectionFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        section: expect.objectContaining({ id: 'bad', name: 'Broken' }),
        reason: 'runtime',
        message: expect.stringContaining('missingValue'),
      }),
    );
  });

  it('forces the fallback for sections the predicate selects', () => {
    renderDnd({
      value: documentWith(
        sectionCode('a', 'Kept', '<p>kept</p>'),
        sectionCode('b', 'Retired', '<p>retired</p>'),
      ),
      shouldForceSectionFallback: section => section.name === 'Retired',
      renderSectionFallback: ({ section, reason }) => (
        <p>
          {section.name} is {reason}
        </p>
      ),
    });

    expect(screen.getByText('kept')).not.toBeNull();
    expect(screen.queryByText('retired')).toBeNull();
    expect(screen.getByText('Retired is forced')).not.toBeNull();
  });

  it('treats a throwing predicate as not forced', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderDnd({
      value: documentWith(sectionCode('a', 'Kept', '<p>kept</p>')),
      shouldForceSectionFallback: () => {
        throw new Error('predicate broke');
      },
    });

    expect(screen.getByText('kept')).not.toBeNull();
  });

  // #97: a section only re-renders when its own props change. A host passing
  // a fresh inline fallback each render must not defeat that, which holds as
  // long as only the fallback itself reads it.
  it('does not re-render sections when only the fallback identity changes', () => {
    let renders = 0;
    const Counter = () => {
      renders += 1;

      return <p>counted</p>;
    };
    const modules = { counter: { Counter } };
    const value = `import { Counter } from 'counter';\n${documentWith(
      sectionCode('a', 'A', '<Counter />'),
    )}`;
    const tree = () => (
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd
          value={value}
          modules={modules}
          onChange={vi.fn()}
          renderSectionFallback={() => <p>fallback</p>}
        >
          <Canvas />
        </Dnd>
      </PreviewContext.Provider>
    );

    const { rerender } = render(tree());
    const before = renders;

    act(() => rerender(tree()));

    expect(before).toBeGreaterThan(0);
    expect(renders).toBe(before);
  });
});

// #710: `Live.Dnd`'s `props` are the sections' component props, as
// `Live.Preview`'s are for its component.
describe('Live.Dnd props', () => {
  const propsDocument = (body: string) => `const App = (props) => (
  <main id="app-container">
    <section data-id="s1" data-name="One">${body}</section>
  </main>
);
export default App;`;
  const probe = propsDocument(
    `<p data-testid="out">title={String(props.title)} preview={String(props.preview)} keys={Object.keys(props).sort().join(',')}</p>`,
  );

  it("passes every key to the section's component, plus container", () => {
    renderDnd({ value: probe, props: { title: 'hello', headers: { a: 1 } } });

    expect(screen.getByTestId('out').textContent).toBe(
      'title=hello preview=undefined keys=container,headers,title',
    );
  });

  it("passes a key named like one of the renderer's props through unchanged", () => {
    const other = `const App = () => <b>hijacked</b>;\nexport default App;`;

    renderDnd({ value: probe, props: { preview: other, title: 't' } });

    // The section still compiles its own content, and gets `preview` as a
    // prop like any other key.
    expect(screen.queryByText('hijacked')).toBeNull();
    expect(screen.getByTestId('out').textContent).toContain(`preview=${other}`);
  });

  it('re-renders sections only when an entry of an inline props object changes', () => {
    let renders = 0;
    const Counter = ({ label }: { label: unknown }) => {
      renders += 1;

      return <p>{String(label)}</p>;
    };
    const modules = { counter: { Counter } };
    const value = `import { Counter } from 'counter';\n${propsDocument(
      '<Counter label={props.label} />',
    )}`;
    const tree = (label: string) => (
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd
          value={value}
          modules={modules}
          props={{ label }}
          onChange={vi.fn()}
        >
          <Canvas />
        </Dnd>
      </PreviewContext.Provider>
    );

    const { rerender } = render(tree('a'));
    const before = renders;

    act(() => rerender(tree('a')));

    expect(before).toBeGreaterThan(0);
    expect(renders).toBe(before);

    act(() => rerender(tree('b')));

    expect(renders).toBeGreaterThan(before);
    expect(screen.getByText('b')).not.toBeNull();
  });
});
