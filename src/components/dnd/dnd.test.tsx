// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TEMPLATE, DRAGGABLE_ITEMS } from '~/constants';

import { PreviewContext } from '../context/states';
import Dnd, { type PanelRenderData } from './dnd';
import Field from './panel/field';

// The canvas isn't what's under test here, and each section renders a
// compiled component inside an iframe — none of which jsdom needs to do for
// us to inspect the data `renderPanel` is handed.
vi.mock('./renderer', () => ({
  default: () => <div data-testid="renderer" />,
}));

// jsdom has no ResizeObserver, which `useResponsiveSize` (via ui-kit's
// breakpoint hook) constructs on mount. Never observes anything here — the
// default breakpoint is enough to land on the desktop layout, where the
// panel renders unconditionally.
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

// Renders Dnd with a custom `renderPanel`, selects the only section by
// clicking it on the canvas, and hands back the data the panel last
// received plus the Dnd-level onChange spy.
const renderWithPanel = () => {
  const onChange = vi.fn();
  const setCode = vi.fn();
  let data: PanelRenderData | undefined;

  const { container } = render(
    <PreviewContext.Provider value={{ code: '', setCode }}>
      <Dnd
        value={documentWith(stats.code)}
        onChange={onChange}
        renderPanel={next => {
          data = next;
          return <div data-testid="panel" />;
        }}
      />
    </PreviewContext.Provider>,
  );

  const sortable = container.querySelector<HTMLElement>(
    '[aria-roledescription="sortable"]',
  );

  expect(sortable).not.toBeNull();

  act(() => sortable!.click());

  return { onChange, getData: () => data };
};

describe('renderPanel data', () => {
  it('forwards the node-level commit callback', () => {
    const { getData } = renderWithPanel();

    expect(getData()?.item).toBeDefined();
    expect(typeof getData()?.onNodeChange).toBe('function');
  });

  it('commits an edit to a data-id that `bindings` cannot reach', () => {
    const { onChange, getData } = renderWithPanel();

    const data = getData()!;
    // Stats' only top-level binding. Everything else in the section lives
    // inside this one's `items` value, so `extract()` never reaches it and
    // no `PanelBinding.onChange` can address it — that's the whole reason
    // `onNodeChange` has to be forwarded (#308).
    expect(data.bindings.map(binding => binding.label)).toEqual([
      'Stats Items',
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
