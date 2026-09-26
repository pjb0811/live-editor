// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TEMPLATE, DRAGGABLE_ITEMS } from '~/constants';

import { PreviewContext } from '../context/states';
import Dnd, { type DndPanel } from './dnd';
import { Canvas } from './layout';
import { useDndPanel } from './layout-context';
import Field from './panel/field';

// The canvas isn't what's under test here, and each section renders a
// compiled component inside an iframe — none of which jsdom needs to do for
// us to inspect the data `useDndPanel()` hands over.
vi.mock('./renderer', () => ({
  default: () => <div data-testid="renderer" />,
}));

// jsdom has no ResizeObserver, which `useResponsiveSize` constructs on
// mount. Never observes anything here, which is fine: the breakpoint only
// decides how the *built-in* layout arranges itself, and these tests supply
// their own children instead. See layout.test.tsx for the breakpoint paths.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const stats = DRAGGABLE_ITEMS.find(item => item.id === 'stats')!;

const documentWith = (sectionCode: string) =>
  DEFAULT_TEMPLATE.replace(
    '<main id="app-container"></main>',
    `<main id="app-container">${sectionCode}</main>`,
  );

// Renders Dnd with a custom layout whose panel is nothing but a probe on
// `useDndPanel()`, selects the only section by clicking it on the canvas, and
// hands back the data the panel last read plus the Dnd-level onChange spy.
const renderWithPanel = () => {
  const onChange = vi.fn();
  const setCode = vi.fn();
  let data: DndPanel | undefined;

  const Probe = () => {
    data = useDndPanel();

    return <div data-testid="panel" />;
  };

  const { container } = render(
    <PreviewContext.Provider value={{ code: '', setCode }}>
      <Dnd value={documentWith(stats.code)} onChange={onChange}>
        <Canvas />
        <Probe />
      </Dnd>
    </PreviewContext.Provider>,
  );

  const sortable = container.querySelector<HTMLElement>(
    '[aria-roledescription="sortable"]',
  );

  expect(sortable).not.toBeNull();

  act(() => sortable!.click());

  return { onChange, getData: () => data };
};

describe('useDndPanel() data', () => {
  it('forwards the node-level commit callback', () => {
    const { getData } = renderWithPanel();

    expect(getData()?.item).toBeDefined();
    expect(typeof getData()?.onNodeChange).toBe('function');
  });

  it('commits an edit to a data-id that `bindings` cannot reach', () => {
    const { onChange, getData } = renderWithPanel();

    const data = getData()!;
    // Stats' only top-level bindings, all on the marquee itself. Everything
    // else in the section lives inside its `items` value, so `extract()`
    // never reaches it and no `PanelBinding.onChange` can address it —
    // that's the whole reason `onNodeChange` has to be forwarded (#308).
    expect(data.bindings.map(binding => binding.label)).toEqual([
      'Stats Items',
      'Scroll Speed',
      'Pause On Hover',
    ]);

    // Where the built-in Items editor finds these: the binding's own raw
    // source, which carries the filled `data-id`s of the nested elements.
    // `item.code` is no use here — element ids are only filled on the copy
    // Dnd derives internally, so there they're still `data-id=""`.
    const items = data.bindings[0]!.rawValue;
    const reachable = new Set(data.bindings.map(binding => binding.id));
    const nestedOnly = [...items.matchAll(/data-id="([^"]+)"/g)]
      .map(match => match[1]!)
      .filter(id => !reachable.has(id));

    expect(nestedOnly.length).toBeGreaterThan(0);

    // The nested Title/Description bindings declare `innerText`, not
    // `children` — `children` belongs to the outer "Stats Cards" wrapper.
    // Committing with the wrong property fails as `binding-not-declared`,
    // which looks identical to this bug from the outside but isn't it, so
    // pin the property the fixture actually declares.
    const titleId = nestedOnly.find(id => {
      const at = items.indexOf(`data-id="${id}"`);
      const after = items.slice(at, at + 400);
      return (
        /label: '([^']+)'/.exec(after)?.[1] === 'Title' &&
        /property: '([^']+)'/.exec(after)?.[1] === 'innerText'
      );
    });

    expect(titleId).toBeDefined();

    data.onNodeChange({
      id: titleId!,
      label: 'Title',
      property: 'innerText',
      value: 'CHANGED',
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toContain('CHANGED');
  });
});

// Two sections, each with one bound heading, so an edit committed through
// the selected section's panel has a sibling whose source can be observed
// in the committed document.
const twoSections = (first: string, second: string) =>
  documentWith(
    `
      <section data-id="s1" data-name="First">
        <h1
          data-id="s1-title"
          data-binding={[{ label: 'Title', property: 'innerText' }]}
        >
          ${first}
        </h1>
      </section>
      <section data-id="s2" data-name="Second">
        <h1
          data-id="s2-title"
          data-binding={[{ label: 'Title', property: 'innerText' }]}
        >
          ${second}
        </h1>
      </section>`,
  );

// Same probe as `renderWithPanel`, but over a two-section document and
// returning `rerender` so a test can change the *unselected* section the way
// an external `value` change would.
const renderTwoSections = () => {
  const onChange = vi.fn();
  const setCode = vi.fn();
  let data: DndPanel | undefined;

  const Probe = () => {
    data = useDndPanel();

    return <div data-testid="panel" />;
  };

  const tree = (value: string) => (
    <PreviewContext.Provider value={{ code: '', setCode }}>
      <Dnd value={value} onChange={onChange}>
        <Canvas />
        <Probe />
      </Dnd>
    </PreviewContext.Provider>
  );

  const { container, rerender } = render(
    tree(twoSections('Original title', 'Old sibling')),
  );

  const sortables = container.querySelectorAll<HTMLElement>(
    '[aria-roledescription="sortable"]',
  );

  expect(sortables).toHaveLength(2);

  act(() => sortables[0]!.click());

  return {
    onChange,
    setCode,
    getData: () => data,
    rerenderWith: (value: string) => rerender(tree(value)),
  };
};

describe('panel commits against the latest document', () => {
  it('keeps a newer edit to another section when a binding commits', () => {
    const { onChange, getData, rerenderWith } = renderTwoSections();

    expect(getData()?.bindings.map(binding => binding.label)).toEqual([
      'Title',
    ]);

    // The selected section's own source is untouched; only its sibling
    // changes. Nothing about the panel's own data should differ, which is
    // exactly why a memo keyed on the parsed fields used to hand back a
    // callback still bound to the previous document.
    act(() => {
      rerenderWith(twoSections('Original title', 'New sibling'));
    });

    act(() => {
      getData()!.bindings[0]!.onChange('Changed title');
    });

    expect(onChange).toHaveBeenCalledTimes(1);

    const committed = onChange.mock.calls[0]![0] as string;

    expect(committed).toContain('Changed title');
    expect(committed).toContain('New sibling');
    expect(committed).not.toContain('Old sibling');
  });

  it('routes `onNodeChange` through the latest document too', () => {
    const { onChange, getData, rerenderWith } = renderTwoSections();

    act(() => {
      rerenderWith(twoSections('Original title', 'New sibling'));
    });

    act(() => {
      getData()!.onNodeChange({
        id: 's1-title',
        label: 'Title',
        property: 'innerText',
        value: 'Changed title',
      });
    });

    const committed = onChange.mock.calls[0]![0] as string;

    expect(committed).toContain('Changed title');
    expect(committed).toContain('New sibling');
  });

  it('does not clear the selection when another section changes', () => {
    const { getData, rerenderWith } = renderTwoSections();

    expect(getData()?.item?.id).toBe('s1');

    act(() => {
      rerenderWith(twoSections('Original title', 'New sibling'));
    });

    expect(getData()?.item?.id).toBe('s1');
  });

  // Undo hands back an *older* document. The commit has to follow it down
  // as readily as it follows an edit forward, or redoing then editing
  // resurrects text the reader just undid. Stepping forward twice before
  // going back one keeps the undo target distinct from the document the
  // bindings were first built against, so a stale closure can't pass this
  // by coincidence.
  it('follows the document backwards when an edit is undone', () => {
    const { onChange, getData, rerenderWith } = renderTwoSections();

    act(() => {
      rerenderWith(twoSections('Original title', 'Second sibling'));
    });

    act(() => {
      rerenderWith(twoSections('Original title', 'Third sibling'));
    });

    act(() => {
      rerenderWith(twoSections('Original title', 'Second sibling'));
    });

    act(() => {
      getData()!.bindings[0]!.onChange('Changed title');
    });

    const committed = onChange.mock.calls[0]![0] as string;

    expect(committed).toContain('Second sibling');
    expect(committed).not.toContain('Third sibling');
    expect(committed).not.toContain('Old sibling');
  });

  // The selected section's own source is identical before and after a move,
  // so `fields` is reused here too — but the document it has to be spliced
  // back into now orders the sections the other way round.
  it('keeps the new order when editing after a move', () => {
    const { onChange, getData, rerenderWith } = renderTwoSections();

    act(() => {
      getData()!.onMoveDown();
    });

    const moved = onChange.mock.calls[0]![0] as string;

    expect(moved.indexOf('data-id="s2"')).toBeLessThan(
      moved.indexOf('data-id="s1"'),
    );

    act(() => {
      rerenderWith(moved);
    });

    act(() => {
      getData()!.bindings[0]!.onChange('Changed title');
    });

    const committed = onChange.mock.calls[1]![0] as string;

    expect(committed).toContain('Changed title');
    expect(committed.indexOf('data-id="s2"')).toBeLessThan(
      committed.indexOf('data-id="s1"'),
    );
  });

  it('does not resurrect a section deleted before the edit', () => {
    const { onChange, getData, rerenderWith } = renderTwoSections();

    act(() => {
      getData()!.onDelete('s2');
    });

    const deleted = onChange.mock.calls[0]![0] as string;

    expect(deleted).not.toContain('data-id="s2"');

    act(() => {
      rerenderWith(deleted);
    });

    act(() => {
      getData()!.bindings[0]!.onChange('Changed title');
    });

    const committed = onChange.mock.calls[1]![0] as string;

    expect(committed).toContain('Changed title');
    expect(committed).not.toContain('data-id="s2"');
  });

  it('commits against the newest `onChange` when the prop is replaced', () => {
    const first = vi.fn();
    const second = vi.fn();
    const setCode = vi.fn();
    let data: DndPanel | undefined;

    const Probe = () => {
      data = useDndPanel();

      return <div data-testid="panel" />;
    };

    const tree = (handler: (value: string) => void) => (
      <PreviewContext.Provider value={{ code: '', setCode }}>
        <Dnd
          value={twoSections('Original title', 'Old sibling')}
          onChange={handler}
        >
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>
    );

    const { container, rerender } = render(tree(first));

    const sortables = container.querySelectorAll<HTMLElement>(
      '[aria-roledescription="sortable"]',
    );

    act(() => sortables[0]!.click());

    act(() => {
      rerender(tree(second));
    });

    act(() => {
      data!.bindings[0]!.onChange('Changed title');
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('Field, exported for per-binding reuse', () => {
  // The point of exporting it: everything it needs is public render data, so
  // a custom panel can delegate one binding without adopting the whole
  // built-in panel. If this ever needs something internal, the export is a
  // lie and this fails.
  it('drives the nested item editors from `bindings` + `onNodeChange` alone', () => {
    const { getData } = renderWithPanel();
    const data = getData()!;
    const onNodeChange = vi.fn();

    const { container } = render(
      <Field binding={data.bindings[0]!} onNodeChange={onNodeChange} />,
    );

    const values = [...container.querySelectorAll('textarea')].map(
      el => el.value,
    );

    // The nested Title/Description leaves Stats' `bindings` can't reach.
    expect(values).toContain('Open');
    expect(values).toContain('Source Project');
    expect(values).toContain('By Doing');
  });

  it('renders the control only, leaving the label to the caller', () => {
    const { getData } = renderWithPanel();
    const data = getData()!;

    const { container } = render(<Field binding={data.bindings[0]!} />);

    // `FieldGroup` draws "Stats Items (items)" in the built-in panel; a
    // consumer supplying their own heading must not get a second one.
    expect(container.textContent).not.toContain('Stats Items');
  });
});
