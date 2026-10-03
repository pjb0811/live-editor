// @vitest-environment jsdom
import { act, fireEvent, render, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TEMPLATE, DRAGGABLE_ITEMS } from '~/constants';
import type { Section } from '~/types';

import { PreviewContext } from '../context/states';
import Dnd, { type DndPalette, type DndPanel } from './dnd';
import { type DndInspector, useDndInspector } from './inspector';
import { Canvas, Palette, Panel } from './layout';
import type { DndLayout } from './layout-context';
import { useDndLayout, useDndPalette, useDndPanel } from './layout-context';
import Field from './panel/field';
import { type DndItems, useDndItems } from './panel/use-dnd-items';

// The canvas isn't what's under test here, and each section renders a
// compiled component inside an iframe — none of which jsdom needs to do for
// us to inspect the data `useDndPanel()` hands over.
// The last preview each section was rendered with, keyed by section id.
const previews = vi.hoisted(() => new Map<string, string>());

vi.mock('./renderer', () => ({
  default: ({ sectionId, preview }: { sectionId: string; preview: string }) => {
    previews.set(sectionId, preview);

    return <div data-testid="renderer" />;
  },
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
  // An element picked in the preview is matched to its fields by `data-id`,
  // so both have to fill a section's empty ids the same way (#432).
  it('gives each binding the data-id its element has in the canvas preview', () => {
    const { getData } = renderWithPanel();
    const data = getData()!;
    const preview = previews.get(data.item!.id)!;

    expect(data.item!.code).toContain('data-id=""');
    expect(data.bindings.length).toBeGreaterThan(0);

    for (const binding of data.bindings) {
      expect(binding.id).toMatch(new RegExp(`^${data.item!.id}-\\d+$`));
      expect(preview).toContain(`data-id="${binding.id}"`);
    }
  });

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

// The selected section has two bound elements, so two commits in one tick
// can write to different elements of the same section.
const twoFields = documentWith(`
  <section data-id="s1" data-name="First">
    <h1 data-id="s1-title" data-binding={[{ label: 'Title', property: 'innerText' }]}>
      Old title
    </h1>
    <p data-id="s1-body" data-binding={[{ label: 'Body', property: 'innerText' }]}>
      Old body
    </p>
  </section>
  <section data-id="s2" data-name="Second">
    <p>Sibling</p>
  </section>`);

const renderTwoFields = (initial = twoFields) => {
  const onChange = vi.fn();
  let data: DndPanel | undefined;

  const Probe = () => {
    data = useDndPanel();

    return <div data-testid="panel" />;
  };

  const tree = (value: string) => (
    <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
      <Dnd value={value} onChange={onChange}>
        <Canvas />
        <Probe />
      </Dnd>
    </PreviewContext.Provider>
  );

  const { container, rerender } = render(tree(initial));

  act(() =>
    container
      .querySelector<HTMLElement>('[aria-roledescription="sortable"]')!
      .click(),
  );

  return {
    onChange,
    getData: () => data!,
    rerenderWith: (value: string) => rerender(tree(value)),
    lastCommit: () => onChange.mock.calls.at(-1)![0] as string,
  };
};

// Every commit used to start from the render's snapshot, and the host only
// hands the new document back on the next render, so the second of two
// commits in one tick wrote the first one's element back as it was (#450).
describe('commits in the same tick', () => {
  it('keeps both of two binding edits', () => {
    const { onChange, getData, lastCommit } = renderTwoFields();
    const [title, body] = getData().bindings;

    act(() => {
      title!.onChange('New title');
      body!.onChange('New body');
    });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(lastCommit()).toContain('New title');
    expect(lastCommit()).toContain('New body');
  });

  it('keeps both of two `onNodeChange` edits', () => {
    const { getData, lastCommit } = renderTwoFields();

    act(() => {
      const { onNodeChange } = getData();

      onNodeChange({
        id: 's1-title',
        label: 'Title',
        property: 'innerText',
        value: 'New title',
      });
      onNodeChange({
        id: 's1-body',
        label: 'Body',
        property: 'innerText',
        value: 'New body',
      });
    });

    expect(lastCommit()).toContain('New title');
    expect(lastCommit()).toContain('New body');
  });

  it('keeps a binding edit made before a section move', () => {
    const { getData, lastCommit } = renderTwoFields();

    act(() => {
      getData().bindings[0]!.onChange('New title');
      getData().onMoveDown();
    });

    expect(lastCommit()).toContain('New title');
    expect(lastCommit().indexOf('data-id="s2"')).toBeLessThan(
      lastCommit().indexOf('data-id="s1"'),
    );
  });

  // The move leaves the selected section's source as it was, so the edit
  // has to come from this render's parse (the one its ids point at) and land
  // in the moved document.
  it('keeps a section move made before a binding edit', () => {
    const { getData, lastCommit } = renderTwoFields();

    act(() => {
      getData().onMoveDown();
      getData().bindings[0]!.onChange('New title');
    });

    expect(lastCommit()).toContain('New title');
    expect(lastCommit().indexOf('data-id="s2"')).toBeLessThan(
      lastCommit().indexOf('data-id="s1"'),
    );
  });

  // A bound element authored with an empty `data-id` only gets its id from
  // this render's `fillIds`, and the binding points at that id. A committed
  // section the move didn't touch still has the empty id, so building on it
  // would miss the element.
  it('keeps an edit to an element whose id this render filled in', () => {
    const { getData, lastCommit } = renderTwoFields(
      twoFields.replace('data-id="s1-title"', 'data-id=""'),
    );

    act(() => {
      getData().onMoveDown();
      getData().bindings[0]!.onChange('New title');
    });

    expect(lastCommit()).toContain('New title');
    expect(lastCommit().indexOf('data-id="s2"')).toBeLessThan(
      lastCommit().indexOf('data-id="s1"'),
    );
  });

  // Once a render has handed in a value, that value wins, even when the
  // host didn't take the earlier commit.
  it('drops an unaccepted commit once the next render arrives', () => {
    const { getData, rerenderWith, lastCommit } = renderTwoFields();

    act(() => {
      getData().bindings[0]!.onChange('Rejected title');
    });

    act(() => {
      rerenderWith(twoFields);
    });

    act(() => {
      getData().bindings[1]!.onChange('New body');
    });

    expect(lastCommit()).toContain('New body');
    expect(lastCommit()).toContain('Old title');
    expect(lastCommit()).not.toContain('Rejected title');
  });
});

// The hook side of #451 end to end: each `useDndItems` edit commits the
// whole array through the same binding, so the second one has to carry the
// first, and the panel commit has to build on the first commit's document.
it('keeps two `useDndItems` edits to one binding in the same tick', () => {
  const onChange = vi.fn();
  let editor: DndItems | undefined;

  const Probe = () => {
    const { bindings } = useDndPanel();
    // No binding until the section is selected; the hook still has to run.
    const binding = bindings.find(candidate => candidate.label === 'Items');

    editor = useDndItems(binding?.rawValue ?? '[]', {
      render: binding?.render,
      onChange: binding?.onChange,
    });

    return <div data-testid="panel" />;
  };

  const { container } = render(
    <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
      <Dnd
        value={documentWith(`
          <section data-id="s1" data-name="List">
            <ul
              data-id="list"
              data-binding={[{ label: 'Items', property: 'items', type: 'array' }]}
              items={[{ label: 'Alpha' }, { label: 'Beta' }]}
            />
          </section>`)}
        onChange={onChange}
      >
        <Canvas />
        <Probe />
      </Dnd>
    </PreviewContext.Provider>,
  );

  act(() =>
    container
      .querySelector<HTMLElement>('[aria-roledescription="sortable"]')!
      .click(),
  );

  act(() => {
    const [alpha, beta] = editor!.items;

    alpha!.properties[0]!.onChange('Alpha 2');
    beta!.properties[0]!.onChange('Beta 2');
  });

  const last = onChange.mock.calls.at(-1)![0] as string;

  expect(last).toContain('Alpha 2');
  expect(last).toContain('Beta 2');
});

// A `<section>` without `data-name` gets a generated name, which the canvas
// and panel show. It used to be a fixed Korean label (#448).
describe('section names', () => {
  const unnamed = documentWith(`
    <section data-id="s1"><p>First</p></section>`);

  const renderUnnamed = (props: {
    sectionNameFallback?: (index: number) => string;
  }) => {
    let data: DndPanel | undefined;

    const Probe = () => {
      data = useDndPanel();

      return <div data-testid="panel" />;
    };

    const { container } = render(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={unnamed} onChange={vi.fn()} {...props}>
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>,
    );

    act(() =>
      container
        .querySelector<HTMLElement>('[aria-roledescription="sortable"]')!
        .click(),
    );

    return data!;
  };

  it('defaults to "Section N"', () => {
    expect(renderUnnamed({}).item?.name).toBe('Section 1');
  });

  it('uses `sectionNameFallback` when given', () => {
    expect(
      renderUnnamed({ sectionNameFallback: index => `Block ${index + 1}` }).item
        ?.name,
    ).toBe('Block 1');
  });
});

// A document without the container element used to take every addition and
// hand back the source unchanged, with nothing to say why (#449).
describe('document container', () => {
  const renderWithPalette = (
    value: string,
    props: { containerId?: string; onEditError?: (error: unknown) => void },
  ) => {
    const onChange = vi.fn();
    let palette: DndPalette | undefined;

    const Probe = () => {
      palette = useDndPalette();

      return <div data-testid="palette" />;
    };

    const tree = (next: string) => (
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={next} onChange={onChange} {...props}>
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>
    );

    const utils = render(tree(value));

    return {
      ...utils,
      onChange,
      add: () => act(() => palette!.onAdd(stats)),
      rerenderWith: (next: string) => utils.rerender(tree(next)),
    };
  };

  it('adds sections inside a container with a custom id', () => {
    const { onChange, add } = renderWithPalette(
      DEFAULT_TEMPLATE.replace('app-container', 'root'),
      { containerId: 'root' },
    );

    add();

    expect(onChange.mock.calls.at(-1)![0]).toContain('data-name="Stats"');
  });

  it('reports a missing container once, with its id', () => {
    const onEditError = vi.fn();
    const { rerenderWith } = renderWithPalette('', { onEditError });

    expect(onEditError).toHaveBeenCalledTimes(1);
    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'parse',
        target: 'document',
        reason: 'container-not-found',
        containerId: 'app-container',
      }),
    );

    // Still missing after another edit: not reported again.
    act(() => rerenderWith('// still no container'));

    expect(onEditError).toHaveBeenCalledTimes(1);
  });

  it('does not report a document that has the container', () => {
    const onEditError = vi.fn();

    renderWithPalette(DEFAULT_TEMPLATE, { onEditError });

    expect(onEditError).not.toHaveBeenCalled();
  });

  it('says on the canvas which container is missing', () => {
    // Scoped to this render: the file doesn't clean up between tests.
    const { container } = renderWithPalette('', { onEditError: vi.fn() });

    expect(container.textContent).toContain(
      'No #app-container element in the document',
    );
  });
});

// A source that doesn't parse, which is what the code editor holds for most
// of a keystroke, used to empty the canvas and the panel until it parsed
// again (#433). Now they keep the last version that parsed, read-only.
// One interaction that writes several bindings should reach the host as one
// change, and never half of one (#425).
// `onChange(undefined)` removes an attribute and a value adds it back, from
// the panel as from `update()` (#426).
describe('removing and adding attributes from the panel', () => {
  const optional = documentWith(`
    <section data-id="s1" data-name="First">
      <a
        data-id="link"
        data-binding={[
          { label: 'Title', property: 'title' },
          { label: 'Target', property: 'target' },
        ]}
        title="Hi"
        target="_blank"
      >
        Link
      </a>
    </section>`);

  const renderOptional = () => renderTwoFields(optional);

  it('removes an attribute with undefined', () => {
    const { getData, lastCommit } = renderOptional();

    act(() => getData().bindings[0]!.onChange(undefined));

    expect(lastCommit()).not.toContain('title=');
    expect(lastCommit()).not.toContain('undefined');
    expect(lastCommit()).toContain('target="_blank"');
  });

  it('removes several attributes as one change', () => {
    const { onChange, getData, lastCommit } = renderOptional();

    act(() =>
      getData().onNodesChange([
        { id: 'link', label: 'Title', property: 'title', value: undefined },
        { id: 'link', label: 'Target', property: 'target', value: undefined },
      ]),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastCommit()).not.toMatch(/title=|target=/);
  });

  it('reports a removed attribute as absent, and adds it back on a value', () => {
    const view = renderOptional();

    act(() => view.getData().bindings[0]!.onChange(undefined));
    view.rerenderWith(view.lastCommit());

    const title = view.getData().bindings[0]!;

    expect(title.present).toBe(false);

    act(() => title.onChange('Back'));

    expect(view.lastCommit()).toContain('title="Back"');
  });
});

describe('onNodesChange', () => {
  const title = { id: 's1-title', label: 'Title', property: 'innerText' };
  const body = { id: 's1-body', label: 'Body', property: 'innerText' };

  const renderNodes = renderTwoFields;

  it('commits several edits as one change', () => {
    const { onChange, getData, lastCommit } = renderNodes();

    act(() =>
      getData().onNodesChange([
        { ...title, value: 'New title' },
        { ...body, value: 'New body' },
      ]),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastCommit()).toContain('New title');
    expect(lastCommit()).toContain('New body');
  });

  it('commits nothing when one edit is refused', () => {
    const { onChange, getData } = renderNodes();

    act(() =>
      getData().onNodesChange([
        { ...title, value: 'New title' },
        { id: 'missing', label: 'Nope', property: 'innerText', value: 'x' },
      ]),
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies in array order, so a later edit to the same property wins', () => {
    const { getData, lastCommit } = renderNodes();

    act(() =>
      getData().onNodesChange([
        { ...title, value: 'Alpha' },
        { ...title, value: 'Beta' },
      ]),
    );

    expect(lastCommit()).toContain('Beta');
    expect(lastCommit()).not.toContain('Alpha');
  });

  it('does nothing for an empty batch', () => {
    const { onChange, getData } = renderNodes();

    act(() => getData().onNodesChange([]));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('builds on a commit made earlier in the same tick', () => {
    const { getData, lastCommit } = renderNodes();

    act(() => {
      getData().onMoveDown();
      getData().onNodesChange([
        { ...title, value: 'New title' },
        { ...body, value: 'New body' },
      ]);
    });

    expect(lastCommit()).toContain('New title');
    expect(lastCommit()).toContain('New body');
    expect(lastCommit().indexOf('data-id="s2"')).toBeLessThan(
      lastCommit().indexOf('data-id="s1"'),
    );
  });

  it('shares its guard with onNodeChange while the document does not parse', () => {
    const view = renderNodes();

    act(() => view.rerenderWith(twoFields.replace('</main>', '<div </main>')));
    act(() => view.getData().onNodesChange([{ ...title, value: 'New title' }]));

    expect(view.onChange).not.toHaveBeenCalled();
  });

  it('leaves a single onNodeChange behaving as a batch of one', () => {
    const { onChange, getData, lastCommit } = renderNodes();

    act(() => getData().onNodeChange({ ...title, value: 'Only title' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastCommit()).toContain('Only title');
  });
});

describe('document that stops parsing', () => {
  const broken = twoFields.replace('</main>', '<div </main>');

  const renderParsing = (initial: string) => {
    const onChange = vi.fn();
    const onEditError = vi.fn();
    let panel: DndPanel | undefined;
    let layout: DndLayout | undefined;

    const Probe = () => {
      panel = useDndPanel();
      layout = useDndLayout();

      return <div data-testid="panel" />;
    };

    const tree = (value: string) => (
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={value} onChange={onChange} onEditError={onEditError}>
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>
    );

    const utils = render(tree(initial));
    const sortables = () =>
      utils.container.querySelectorAll<HTMLElement>(
        '[aria-roledescription="sortable"]',
      );

    return {
      ...utils,
      onChange,
      onEditError,
      sortables,
      getPanel: () => panel!,
      getLayout: () => layout!,
      rerenderWith: (value: string) => act(() => utils.rerender(tree(value))),
    };
  };

  const selectFirst = (sortables: () => NodeListOf<HTMLElement>) =>
    act(() => sortables()[0]!.click());

  it('keeps the last parsed sections and selection, read-only', () => {
    const view = renderParsing(twoFields);

    selectFirst(view.sortables);
    view.rerenderWith(broken);

    expect(view.sortables()).toHaveLength(2);
    expect(view.getPanel().item?.id).toBe('s1');
    expect(view.getPanel().bindings.map(b => b.label)).toEqual([
      'Title',
      'Body',
    ]);
    expect(view.getPanel().readOnly).toBe(true);
    expect(view.getLayout().documentError).toBe('parse-error');
    expect(view.container.textContent).toContain(
      'Showing the last version that parsed',
    );
    // Not reported just for being broken: that's every other keystroke.
    expect(view.onEditError).not.toHaveBeenCalled();
  });

  it('refuses edits while stale, and says why', () => {
    const view = renderParsing(twoFields);

    selectFirst(view.sortables);
    view.rerenderWith(broken);

    act(() => view.getPanel().bindings[0]!.onChange('New title'));
    act(() => view.getPanel().onMoveDown());
    act(() => view.getPanel().onDelete('s1'));

    expect(view.onChange).not.toHaveBeenCalled();
    expect(view.onEditError).toHaveBeenCalledTimes(3);
    expect(view.onEditError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'parse',
        target: 'document',
        reason: 'parse-error',
      }),
    );
  });

  it('edits again once the source parses', () => {
    const view = renderParsing(twoFields);

    selectFirst(view.sortables);
    view.rerenderWith(broken);
    view.rerenderWith(twoFields);

    expect(view.getPanel().readOnly).toBe(false);
    expect(view.getLayout().documentError).toBeNull();

    act(() => view.getPanel().bindings[0]!.onChange('New title'));

    expect(view.onChange.mock.calls.at(-1)![0]).toContain('New title');
  });

  it('says so when the source has never parsed', () => {
    const view = renderParsing(broken);

    expect(view.sortables()).toHaveLength(0);
    expect(view.getLayout().documentError).toBe('parse-error');
    expect(view.getPanel().readOnly).toBe(false);
    expect(view.container.textContent).toContain(
      'The document has a syntax error',
    );
  });

  it('is not stale for a missing container', () => {
    const view = renderParsing('');

    expect(view.getLayout().documentError).toBe('container-not-found');
    expect(view.getPanel().readOnly).toBe(false);
  });
});

// A `<section>` carrying its own `data-binding` used to be dropped from the
// panel's fields, so a background or padding on the section itself couldn't
// be edited (#429).
describe('section root bindings', () => {
  const rooted = documentWith(`
    <section
      data-id="s1"
      data-name="Hero"
      className="py-8"
      data-binding={[
        { label: 'Padding', property: 'className' },
        { label: 'Name', property: 'data-name' },
      ]}
    >
      <h1
        data-id="s1-title"
        data-binding={[{ label: 'Title', property: 'innerText' }]}
      >
        Hello
      </h1>
    </section>`);

  const renderRooted = () => {
    const onChange = vi.fn();
    const onEditError = vi.fn();
    let panel: DndPanel | undefined;

    const Probe = () => {
      panel = useDndPanel();

      return <div data-testid="panel" />;
    };

    const { container } = render(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={rooted} onChange={onChange} onEditError={onEditError}>
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>,
    );

    act(() =>
      container
        .querySelector<HTMLElement>('[aria-roledescription="sortable"]')!
        .click(),
    );

    return { onChange, onEditError, getPanel: () => panel! };
  };

  it("lists the section's own bindings ahead of its children's", () => {
    const { getPanel } = renderRooted();

    expect(
      getPanel().bindings.map(b => [b.id, b.label, b.canEditValue]),
    ).toEqual([
      ['s1', 'Padding', undefined],
      ['s1', 'Name', false],
      ['s1-title', 'Title', undefined],
    ]);
  });

  it('edits the section root through its binding', () => {
    const { onChange, getPanel } = renderRooted();

    act(() => getPanel().bindings[0]!.onChange('py-16'));

    const committed = onChange.mock.calls.at(-1)![0] as string;

    expect(committed).toContain('className="py-16"');
    expect(committed).toContain('data-name="Hero"');
    expect(committed).toContain('data-id="s1"');
  });

  it('refuses to rewrite data-name, and says why', () => {
    const { onChange, onEditError, getPanel } = renderRooted();

    act(() => getPanel().bindings[1]!.onChange('Renamed'));

    expect(onChange).not.toHaveBeenCalled();
    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'update',
        property: 'data-name',
        failure: expect.objectContaining({ reason: 'reserved-property' }),
      }),
    );
  });

  it('adds nothing for a section without a data-binding', () => {
    const { getData } = renderWithPanel();
    const rootId = getData()!.item!.id;

    expect(getData()!.bindings.length).toBeGreaterThan(0);
    expect(getData()!.bindings.some(binding => binding.id === rootId)).toBe(
      false,
    );
  });
});

// Sections and palette cards are `role="button"` and reachable with Tab, but
// did nothing on Enter, so the keyboard could reach them and not use them
// (#435).
describe('keyboard', () => {
  const renderKeyboard = () => {
    const onChange = vi.fn();
    let panel: DndPanel | undefined;

    const Probe = () => {
      panel = useDndPanel();

      return <div data-testid="panel" />;
    };

    const utils = render(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd
          value={twoSections('Original title', 'Sibling')}
          onChange={onChange}
        >
          <Palette />
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>,
    );

    const sortables = () =>
      utils.container.querySelectorAll<HTMLElement>(
        '[aria-roledescription="sortable"]',
      );

    return { ...utils, onChange, sortables, getPanel: () => panel! };
  };

  it('selects a focused section with Enter', () => {
    const { sortables, getPanel } = renderKeyboard();

    expect(getPanel().item).toBeUndefined();

    act(() => {
      fireEvent.keyDown(sortables()[1]!, { key: 'Enter', code: 'Enter' });
    });

    expect(getPanel().item?.id).toBe('s2');
  });

  it('ignores Enter that reaches the section from a button inside it', () => {
    const { sortables, getPanel, container } = renderKeyboard();

    act(() => sortables()[0]!.click());

    const button = container.querySelector<HTMLElement>(
      '[aria-roledescription="sortable"] button',
    )!;

    act(() => {
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    });

    // Still selected: a bubbled Enter didn't toggle the selection off.
    expect(getPanel().item?.id).toBe('s1');
  });

  it('adds a focused palette card with Enter', () => {
    const { onChange, container } = renderKeyboard();
    const card = container.querySelector<HTMLElement>(
      '[aria-roledescription="draggable"]',
    )!;

    act(() => {
      fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      (onChange.mock.calls[0]![0] as string).match(/<section/g),
    ).toHaveLength(3);
  });
});

// Arrow keys and Home/End move between sections, Delete removes the focused
// one, and focus stays on the canvas throughout (#435).
describe('keyboard navigation', () => {
  const threeSections = documentWith(`
    <section data-id="s1" data-name="First"><p>1</p></section>
    <section data-id="s2" data-name="Second"><p>2</p></section>
    <section data-id="s3" data-name="Third"><p>3</p></section>`);

  const renderNav = (
    onBeforeDelete?: (section: Section) => boolean | Promise<boolean>,
  ) => {
    const onChange = vi.fn();
    let panel: DndPanel | undefined;

    const Probe = () => {
      panel = useDndPanel();

      return <div data-testid="panel" />;
    };

    const utils = render(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd
          value={threeSections}
          onChange={onChange}
          onBeforeDelete={onBeforeDelete}
        >
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>,
    );

    const sortables = () =>
      utils.container.querySelectorAll<HTMLElement>(
        '[aria-roledescription="sortable"]',
      );
    const press = (index: number, key: string) =>
      act(() => {
        sortables()[index]!.focus();
        fireEvent.keyDown(sortables()[index]!, { key, code: key });
      });

    return { onChange, sortables, press, getPanel: () => panel! };
  };

  it('moves focus and selection with the arrow keys', () => {
    const { sortables, press, getPanel } = renderNav();

    press(0, 'ArrowDown');

    expect(getPanel().item?.id).toBe('s2');
    expect(document.activeElement).toBe(sortables()[1]);

    press(1, 'ArrowUp');

    expect(getPanel().item?.id).toBe('s1');
    expect(document.activeElement).toBe(sortables()[0]);
  });

  it('keeps the selection at either end instead of deselecting', () => {
    const { press, getPanel } = renderNav();

    press(0, 'ArrowDown');
    press(1, 'ArrowDown');
    press(2, 'ArrowDown');

    expect(getPanel().item?.id).toBe('s3');
  });

  it('jumps to the first and last section with Home and End', () => {
    const { sortables, press, getPanel } = renderNav();

    press(0, 'End');

    expect(getPanel().item?.id).toBe('s3');
    expect(document.activeElement).toBe(sortables()[2]);

    press(2, 'Home');

    expect(getPanel().item?.id).toBe('s1');
  });

  it('deletes the focused section and moves focus to the next one', () => {
    const { onChange, sortables, press } = renderNav();
    const next = sortables()[2]!;

    press(1, 'Delete');

    expect(onChange.mock.calls.at(-1)![0]).not.toContain('data-id="s2"');
    expect(document.activeElement).toBe(next);
  });

  it('moves focus to the previous section after deleting the last one', () => {
    const { sortables, press } = renderNav();
    const previous = sortables()[1]!;

    press(2, 'Backspace');

    expect(document.activeElement).toBe(previous);
  });

  it('asks onBeforeDelete, and leaves focus alone when it says no', () => {
    const onBeforeDelete = vi.fn(() => false);
    const { onChange, sortables, press } = renderNav(onBeforeDelete);

    press(1, 'Delete');

    expect(onBeforeDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's2' }),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(sortables()[1]);
  });

  it('ignores the keys when they come from inside the section', () => {
    const { sortables, getPanel } = renderNav();
    const inner = sortables()[0]!.querySelector('div')!;

    act(() => {
      fireEvent.keyDown(inner, { key: 'ArrowDown', code: 'ArrowDown' });
      fireEvent.keyDown(inner, { key: 'Delete', code: 'Delete' });
    });

    expect(getPanel().item).toBeUndefined();
    expect(sortables()).toHaveLength(3);
  });
});

// Bindings from `Live.Dnd`'s registry instead of each element's own
// `data-binding` (#509).
describe('binding registry', () => {
  const registry = {
    h2: [{ label: 'Heading', property: 'innerText' }],
  };

  const section = documentWith(`
    <section data-id="s1" data-name="First">
      <h2 data-id="t1">Registered</h2>
      <h2 data-id="t2" data-binding={[{ label: 'Own', property: 'title' }]} title="x">Own</h2>
      <h2 data-id="t3" data-binding={[]}>Opted out</h2>
    </section>`);

  const renderRegistry = () => {
    const onChange = vi.fn();
    let panel: DndPanel | undefined;

    const Probe = () => {
      panel = useDndPanel();

      return <div data-testid="panel" />;
    };

    const { container } = render(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={section} onChange={onChange} bindings={registry}>
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>,
    );

    act(() =>
      container
        .querySelector<HTMLElement>('[aria-roledescription="sortable"]')!
        .click(),
    );

    return { onChange, getPanel: () => panel! };
  };

  it("gives elements without data-binding their tag's fields", () => {
    const { getPanel } = renderRegistry();

    expect(
      getPanel().bindings.map(binding => [binding.id, binding.label]),
    ).toEqual([
      ['t1', 'Heading'],
      ['t2', 'Own'],
    ]);
  });

  it('commits a registered field', () => {
    const { onChange, getPanel } = renderRegistry();

    act(() => getPanel().bindings[0]!.onChange('Renamed'));

    expect(onChange.mock.calls.at(-1)![0]).toContain(
      '<h2 data-id="t1">Renamed</h2>',
    );
  });
});

// The selected section's own toolbar on the canvas (#505).
describe('section toolbar', () => {
  const threeSections = documentWith(`
    <section data-id="s1" data-name="First"><p>1</p></section>
    <section data-id="s2" data-name="Second"><p>2</p></section>
    <section data-id="s3" data-name="Third"><p>3</p></section>`);

  const renderToolbar = () => {
    const onChange = vi.fn();
    let panel: DndPanel | undefined;

    const Probe = () => {
      panel = useDndPanel();

      return <div data-testid="panel" />;
    };

    const utils = render(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={threeSections} onChange={onChange}>
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>,
    );

    const sortables = () =>
      utils.container.querySelectorAll<HTMLElement>(
        '[aria-roledescription="sortable"]',
      );
    const select = (index: number) => act(() => sortables()[index]!.click());
    const button = (index: number, name: string) =>
      within(sortables()[index]!).getByRole('button', { name });
    const order = (code: string) =>
      ['s1', 's2', 's3'].sort(
        (a, b) =>
          code.indexOf(`data-id="${a}"`) - code.indexOf(`data-id="${b}"`),
      );

    return {
      ...utils,
      onChange,
      sortables,
      select,
      button,
      order,
      getPanel: () => panel!,
    };
  };

  it('shows named buttons on the selected section only', () => {
    const { sortables, select, button } = renderToolbar();

    expect(within(sortables()[1]!).queryAllByRole('button')).toHaveLength(0);

    select(1);

    for (const name of [
      'Move section up',
      'Move section down',
      'Duplicate section',
      'Delete section',
    ]) {
      expect(button(1, name)).toBeTruthy();
    }

    expect(within(sortables()[0]!).queryAllByRole('button')).toHaveLength(0);
  });

  it('moves the section and keeps it selected', () => {
    const { onChange, select, button, order, getPanel, rerender } =
      renderToolbar();

    select(1);
    act(() => button(1, 'Move section up').click());

    const moved = onChange.mock.calls.at(-1)![0] as string;

    expect(order(moved)).toEqual(['s2', 's1', 's3']);

    rerender(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={moved} onChange={onChange}>
          <Canvas />
        </Dnd>
      </PreviewContext.Provider>,
    );

    expect(getPanel().item?.id).toBe('s2');

    act(() => button(0, 'Move section down').click());

    expect(order(onChange.mock.calls.at(-1)![0] as string)).toEqual([
      's1',
      's2',
      's3',
    ]);
  });

  it('disables moving past either end', () => {
    const { select, button } = renderToolbar();

    select(0);

    expect(button(0, 'Move section up')).toHaveProperty('disabled', true);
    expect(button(0, 'Move section down')).toHaveProperty('disabled', false);

    select(2);

    expect(button(2, 'Move section up')).toHaveProperty('disabled', false);
    expect(button(2, 'Move section down')).toHaveProperty('disabled', true);
  });

  it('focuses the section when the move reaches an end', () => {
    const { sortables, select, button } = renderToolbar();

    select(1);
    act(() => button(1, 'Move section up').click());

    expect(document.activeElement).toBe(sortables()[1]);
  });
});

describe('onBeforeDelete', () => {
  const renderDeletable = (onBeforeDelete?: (section: Section) => unknown) => {
    const onChange = vi.fn();
    let panel: DndPanel | undefined;

    const Probe = () => {
      panel = useDndPanel();

      return <div data-testid="panel" />;
    };

    const tree = (value: string) => (
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd
          value={value}
          onChange={onChange}
          onBeforeDelete={
            onBeforeDelete as (section: Section) => boolean | Promise<boolean>
          }
        >
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>
    );

    const utils = render(tree(twoSections('Original title', 'Sibling')));

    return {
      onChange,
      getPanel: () => panel!,
      rerenderWith: (value: string) => act(() => utils.rerender(tree(value))),
    };
  };

  it('deletes when it returns true, and is given the section', () => {
    const onBeforeDelete = vi.fn(() => true);
    const { onChange, getPanel } = renderDeletable(onBeforeDelete);

    act(() => getPanel().onDelete('s2'));

    expect(onBeforeDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's2', name: 'Second' }),
    );
    expect(onChange.mock.calls.at(-1)![0]).not.toContain('data-id="s2"');
  });

  it('keeps the section when it returns false', () => {
    const { onChange, getPanel } = renderDeletable(() => false);

    act(() => getPanel().onDelete('s2'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('waits for a promise', async () => {
    let answer!: (value: boolean) => void;
    const { onChange, getPanel } = renderDeletable(
      () => new Promise<boolean>(resolve => (answer = resolve)),
    );

    act(() => getPanel().onDelete('s2'));

    expect(onChange).not.toHaveBeenCalled();

    await act(async () => answer(true));

    expect(onChange.mock.calls.at(-1)![0]).not.toContain('data-id="s2"');
  });

  // While the host's confirmation is open the document can change. The
  // delete has to land on the document as it is then, not as it was when
  // the question was asked.
  it('deletes from the document as it is when the promise settles', async () => {
    let answer!: (value: boolean) => void;
    const { onChange, getPanel, rerenderWith } = renderDeletable(
      () => new Promise<boolean>(resolve => (answer = resolve)),
    );

    act(() => getPanel().onDelete('s2'));
    rerenderWith(twoSections('Edited meanwhile', 'Sibling'));

    await act(async () => answer(true));

    const committed = onChange.mock.calls.at(-1)![0] as string;

    expect(committed).toContain('Edited meanwhile');
    expect(committed).not.toContain('data-id="s2"');
  });

  it('keeps the section when it throws or rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = renderDeletable(() => {
      throw new Error('no');
    });

    act(() => throwing.getPanel().onDelete('s2'));

    const rejecting = renderDeletable(() => Promise.reject(new Error('no')));

    await act(async () => rejecting.getPanel().onDelete('s2'));

    expect(throwing.onChange).not.toHaveBeenCalled();
    expect(rejecting.onChange).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
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

// Picking an element in the canvas preview (#432). The renderer is mocked,
// so the test marks it as the picked element and says what's under the
// pointer.
describe('element picker', () => {
  const renderWithPicker = () => {
    const onNodePick = vi.fn();
    const state: { inspector?: DndInspector; panel?: DndPanel } = {};

    const Probe = () => {
      state.inspector = useDndInspector();
      state.panel = useDndPanel();

      return null;
    };

    const view = render(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={documentWith(stats.code)} onNodePick={onNodePick}>
          <Canvas />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>,
    );
    const sortable = view.container.querySelector<HTMLElement>(
      '[aria-roledescription="sortable"]',
    )!;
    const overlay = sortable.firstElementChild!;
    const preview = sortable.querySelector('[data-testid="renderer"]')!;

    preview.setAttribute('data-id', 'picked-1');
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [overlay, preview, sortable],
    });

    const pickButton = within(view.container).getByRole('button', {
      name: 'Pick an element',
    });

    return { onNodePick, state, sortable, overlay, pickButton };
  };

  it('selects the section and reports the element picked', () => {
    const {
      onNodePick,
      state,
      sortable,
      overlay,
      pickButton: button,
    } = renderWithPicker();

    fireEvent.click(button);

    expect(state.inspector!.active).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    // Sorting is off while picking.
    expect(sortable.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(overlay, { clientX: 10, clientY: 10 });

    const sectionId = state.panel!.item!.id;

    expect(onNodePick).toHaveBeenCalledWith({ id: 'picked-1', sectionId });
    expect(state.inspector!.picked).toEqual({ id: 'picked-1', sectionId });
    expect(state.inspector!.active).toBe(false);
    expect(sortable.getAttribute('aria-disabled')).toBe('false');
  });

  it('outlines the element under the pointer', () => {
    const { overlay, state } = renderWithPicker();

    act(() => state.inspector!.activate());
    fireEvent.pointerMove(overlay, { clientX: 10, clientY: 10 });

    expect(
      document.body.querySelector('[data-dnd-inspector-highlight]'),
    ).not.toBeNull();

    fireEvent.pointerLeave(overlay);

    expect(
      document.body.querySelector('[data-dnd-inspector-highlight]'),
    ).toBeNull();
  });

  it('stops on Escape without picking', () => {
    const { onNodePick, state } = renderWithPicker();

    act(() => state.inspector!.activate());
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(state.inspector!.active).toBe(false);
    expect(onNodePick).not.toHaveBeenCalled();
  });

  it("marks the picked element's fields in the built-in panel", () => {
    const state: { inspector?: DndInspector; panel?: DndPanel } = {};

    const Probe = () => {
      state.inspector = useDndInspector();
      state.panel = useDndPanel();

      return null;
    };

    const { container } = render(
      <PreviewContext.Provider value={{ code: '', setCode: vi.fn() }}>
        <Dnd value={documentWith(stats.code)}>
          <Canvas />
          <Panel />
          <Probe />
        </Dnd>
      </PreviewContext.Provider>,
    );
    const sortable = container.querySelector<HTMLElement>(
      '[aria-roledescription="sortable"]',
    )!;
    const overlay = sortable.firstElementChild!;
    const preview = sortable.querySelector('[data-testid="renderer"]')!;

    // Select the section first to learn its element ids.
    fireEvent.click(overlay);

    const target = state.panel!.bindings[0]!.id;

    preview.setAttribute('data-id', target);
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [overlay, preview, sortable],
    });
    act(() => state.inspector!.activate());
    fireEvent.click(overlay, { clientX: 10, clientY: 10 });

    const marked = container.querySelectorAll('[data-picked]');

    expect(marked).toHaveLength(1);
    expect(marked[0]!.getAttribute('data-node-id')).toBe(target);
  });

  it('selects the section on a click when the picker is off', () => {
    const { onNodePick, state, overlay } = renderWithPicker();

    fireEvent.click(overlay, { clientX: 10, clientY: 10 });

    expect(state.panel!.item).toBeDefined();
    expect(onNodePick).not.toHaveBeenCalled();
    expect(state.inspector!.picked).toBeNull();
  });
});
