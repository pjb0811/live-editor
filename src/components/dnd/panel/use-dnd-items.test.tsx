// @vitest-environment jsdom
import { Toast } from '@jbpark/ui-kit';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DataAttrNode } from '~/utils/ast';

import { type DndItemsItem, useDndItems } from './use-dnd-items';

const objects = `[
  { key: 'a', label: 'Alpha' },
  { key: 'b', label: 'Beta' },
  { key: 'c', label: 'Gamma' },
]`;

const primitives = `['one', 'two', 'three']`;

// An item whose `children` holds JSX carrying its own data-binding — the
// shape `bindings` can't reach, which is the whole reason this hook does
// its own extraction (#308).
const nested = `[
  {
    key: 'row',
    children: (
      <div data-id="wrap" data-binding={[{ label: 'Cards', property: 'children' }]}>
        <p data-id="t1" data-binding={[{ label: 'Title', property: 'innerText' }]}>Open</p>
        <p data-id="d1" data-binding={[{ label: 'Body', property: 'innerText' }]}>Source</p>
      </div>
    ),
  },
]`;

const fallbacks = `[
  { key: 'a', children: <div>A content</div> },
  { key: 'b', children: <div>B content</div> },
]`;

describe('useDndItems derivation', () => {
  it('resolves object items to PanelBindings, no AST types leaking out', () => {
    const { result } = renderHook(() => useDndItems(objects));

    expect(result.current.kind).toBe('object');
    expect(result.current.items).toHaveLength(3);

    const first = result.current.items[0]!;
    expect(first.properties.map(p => p.label)).toEqual(['key', 'label']);
    expect(first.properties[0]!.rawValue).toBe('a');
    expect(typeof first.properties[0]!.onChange).toBe('function');
  });

  it('exposes a primitive array as one binding per item', () => {
    const { result } = renderHook(() => useDndItems(primitives));

    expect(result.current.kind).toBe('primitive');
    expect(result.current.items.map(i => i.value!.rawValue)).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(result.current.items[0]!.properties).toEqual([]);
  });

  it('keeps unsupported item expressions visible but code-editor-only', () => {
    const { result } = renderHook(() =>
      useDndItems(`[getValue(), \`hello ${'${name}'}\`, theme.value]`),
    );

    expect(result.current.items.map(item => item.value!.rawValue)).toEqual([
      'getValue()',
      '`hello ${name}`',
      'theme.value',
    ]);
    expect(result.current.items.map(item => item.value!.canEditValue)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('marks partially modeled object properties as code-editor-only', () => {
    const { result } = renderHook(() =>
      useDndItems(`[{ config: { ...defaults, label: getLabel() } }]`),
    );
    const config = result.current.items[0]!.properties[0]!;

    expect(config.rawValue).toBe('{ ...defaults, label: getLabel() }');
    expect(config.canEditValue).toBe(false);
  });

  it('finds data-bound elements nested inside a JSX-valued property', () => {
    const { result } = renderHook(() => useDndItems(nested));

    const groups = result.current.items[0]!.nested;
    expect(groups.map(g => g.property)).toEqual(['children']);

    // The wrapper declares `children`, so it wins outright — listing the
    // <p>s separately would offer the same edit twice.
    const elements = groups[0]!.elements;
    expect(elements.map(e => e.id)).toEqual(['wrap']);
    expect(elements[0]!.bindings.map(b => b.label)).toEqual(['Cards']);
  });

  it('commits a nested binding through onNodeChange, keyed by data-id', () => {
    const onNodeChange = vi.fn();
    const { result } = renderHook(() => useDndItems(nested, { onNodeChange }));

    result.current.items[0]!.nested[0]!.elements[0]!.bindings[0]!.onChange(
      'next',
    );

    expect(onNodeChange).toHaveBeenCalledWith({
      id: 'wrap',
      label: 'Cards',
      property: 'children',
      value: 'next',
    });
  });

  it('reports a parse error instead of throwing on a non-array source', () => {
    const { result } = renderHook(() => useDndItems('not an array'));

    expect(result.current.parseError).toBe(true);
    expect(result.current.canEditStructure).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it.each([
    { source: objects, supported: true },
    { source: `[, {label:'A'}]`, supported: false },
    { source: `[...rows, {label:'A'}]`, supported: false },
    { source: `[(value), {label:'A'}]`, supported: false },
  ])(
    'reports structural edit support from the mutation syntax gate: $source',
    ({ source, supported }) => {
      const { result } = renderHook(() => useDndItems(source));

      expect(result.current.canEditStructure).toBe(supported);
    },
  );
});

describe('useDndItems mutations', () => {
  it('adds, removes and moves through the array source', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(objects, { onChange }));

    act(() => result.current.actions.add());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toContain("key: 'a'");

    act(() => result.current.actions.remove(0));
    expect(onChange.mock.calls[1]![0]).not.toContain("key: 'a'");

    act(() => result.current.actions.move(0, 1));
    const moved = onChange.mock.calls[2]![0];
    expect(moved.indexOf("key: 'b'")).toBeLessThan(moved.indexOf("key: 'a'"));
  });

  it('clears the selection after a move, so a later bulk action can not target stale positions', () => {
    // Positions shift but the count doesn't, so useMultiSelect never
    // reconciles the set on its own. See #285.
    const { result } = renderHook(() => useDndItems(objects));

    act(() => result.current.selection.toggle(0, false));
    expect(result.current.selection.selected.size).toBe(1);

    act(() => result.current.actions.move(0, 1));
    expect(result.current.selection.selected.size).toBe(0);
  });

  it('clears the selection after a delete', () => {
    const { result } = renderHook(() => useDndItems(objects));

    act(() => result.current.selection.toggle(2, false));
    act(() => result.current.actions.remove(0));

    expect(result.current.selection.selected.size).toBe(0);
  });

  it('translates selection indices to element positions for bulk actions', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(objects, { onChange }));

    act(() => result.current.selection.toggle(1, false));
    act(() => result.current.actions.removeSelected());

    // Index 1 is Beta. Addressing by the visible index without translating
    // would be right here only because the array is all one kind — the
    // point is that Alpha and Gamma survive.
    const next = onChange.mock.calls[0]![0];
    expect(next).toContain("key: 'a'");
    expect(next).not.toContain("key: 'b'");
    expect(next).toContain("key: 'c'");
  });

  it('replaces the selection with the moved positions on a bulk move', () => {
    const { result } = renderHook(() => useDndItems(objects));

    act(() => result.current.selection.toggle(1, false));
    act(() => result.current.actions.moveSelected('up'));

    // Not cleared — the items are still selected, at their new positions.
    expect([...result.current.selection.selected]).toEqual([0]);
  });

  it('moves a JSX fallback binding identity with its item', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ source }) => useDndItems(source, { onChange }),
      { initialProps: { source: fallbacks } },
    );
    const bindingId = result.current.items[0]!.nested[0]!.fallback!.id;

    act(() => result.current.actions.move(0, 1));
    rerender({ source: onChange.mock.calls[0]![0] });

    const next = result.current.items.find(item =>
      item.nested[0]!.fallback!.rawValue.includes('A content'),
    );

    expect(next?.nested[0]!.fallback!.id).toBe(bindingId);
  });
});

describe('useDndItems source fidelity', () => {
  it('uses original indices for value edits in a sparse array with a spread', () => {
    const source = `[, ...rows, {label:'A'}, /* keep */ {label:'B'},]`;
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(source, { onChange }));

    expect(result.current.items.map(item => item.elementIndex)).toEqual([2, 3]);
    act(() => result.current.items[0]!.properties[0]!.onChange('Changed'));
    expect(onChange).toHaveBeenCalledWith(source.replace("'A'", '"Changed"'));
  });

  it('preserves selection and source when sparse structural edits are refused', () => {
    const onChange = vi.fn();
    const toast = vi.spyOn(Toast, 'error').mockImplementation(() => 'test');
    const { result } = renderHook(() =>
      useDndItems(`[, {label:'A'}, {label:'B'}]`, { onChange }),
    );

    try {
      act(() => result.current.selection.toggle(1, false));
      act(() => result.current.actions.remove(1));
      act(() => result.current.actions.moveSelected('up'));
      act(() => result.current.actions.duplicateSelected());
      expect(onChange).not.toHaveBeenCalled();
      expect([...result.current.selection.selected]).toEqual([1]);
      expect(toast).toHaveBeenCalledWith(
        'Failed to update this item',
        expect.objectContaining({
          description: expect.stringContaining('source was preserved'),
        }),
      );
    } finally {
      toast.mockRestore();
    }
  });

  it('maps bulk move selection back to visible indices in mixed arrays', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ source }) => useDndItems(source, { onChange }),
      { initialProps: { source: `[0, {label:'A'}, {label:'B'}]` } },
    );

    act(() => result.current.selection.toggle(1, false));
    act(() => result.current.actions.moveSelected('up'));
    const moved = onChange.mock.calls[0]![0];
    rerender({ source: moved });
    expect([...result.current.selection.selected]).toEqual([0]);
    act(() => result.current.actions.removeSelected());
    expect(onChange.mock.calls[1]![0]).toContain("label:'A'");
    expect(onChange.mock.calls[1]![0]).not.toContain("label:'B'");
  });

  it('retains nested array and JSX source in panel bindings', () => {
    const raw = `[, /* gap */ {label:'A'},]`;
    const jsx = `<p data-id='p' data-binding={[{label:'Children',property:'children'}]}><b data-id='b'>{value}</b></p>`;
    const { result } = renderHook(() =>
      useDndItems(`[{ nested: ${raw}, children: ${jsx} }]`),
    );

    expect(result.current.items[0]!.properties[0]!.rawValue).toBe(raw);
    const children = result.current.items[0]!.nested[0]!.elements[0]!
      .bindings[0]!.value as DataAttrNode[];
    expect(children[0]!.source).toBe("<b data-id='b'>{value}</b>");
  });
});

// Every edit computes a whole new array, and the host only hands it back as
// `value` on the next render. Two edits in one tick used to both start from
// the rendered array, so the second dropped the first (#451).
describe('useDndItems edits in the same tick', () => {
  const labelOf = (item: DndItemsItem) =>
    item.properties.find(property => property.label === 'label')!;

  it('keeps both of two adds', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ source }) => useDndItems(source, { onChange }),
      { initialProps: { source: objects } },
    );

    act(() => {
      result.current.actions.add();
      result.current.actions.add();
    });

    const last = onChange.mock.calls.at(-1)![0] as string;

    // An appended item copies the first one, under a fresh key.
    expect(last.match(/label: 'Alpha'/g)).toHaveLength(3);

    rerender({ source: last });

    const ids = result.current.items.map(item => item.id);

    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it('keeps property edits to two different items', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(objects, { onChange }));
    const [alpha, beta] = result.current.items;

    act(() => {
      labelOf(alpha!).onChange('Alpha 2');
      labelOf(beta!).onChange('Beta 2');
    });

    const last = onChange.mock.calls.at(-1)![0] as string;

    expect(last).toContain('Alpha 2');
    expect(last).toContain('Beta 2');
  });

  it('keeps value edits to two different primitive items', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(primitives, { onChange }));
    const [one, two] = result.current.items;

    act(() => {
      one!.value!.onChange('ONE');
      two!.value!.onChange('TWO');
    });

    const last = onChange.mock.calls.at(-1)![0] as string;

    expect(last).toContain('ONE');
    expect(last).toContain('TWO');
    expect(last).toContain('three');
  });

  // The binding was handed out before the move, so it names the item by
  // where it used to be. The edit has to follow the item, not the position.
  it('edits the moved item, not whatever took its place', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(objects, { onChange }));
    const alpha = result.current.items[0]!;

    act(() => {
      result.current.actions.move(alpha.elementIndex, 1);
      labelOf(alpha).onChange('Alpha 2');
    });

    const last = onChange.mock.calls.at(-1)![0] as string;

    expect(last).toMatch(/key: 'a', label: ["']Alpha 2["']/);
    expect(last).toContain("{ key: 'b', label: 'Beta' }");
    expect(last.indexOf("key: 'b'")).toBeLessThan(last.indexOf("key: 'a'"));
  });

  it('drops an edit to an item removed earlier in the tick', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(objects, { onChange }));
    const alpha = result.current.items[0]!;

    act(() => {
      result.current.actions.remove(alpha.elementIndex);
      labelOf(alpha).onChange('Alpha 2');
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).not.toContain("key: 'a'");
  });

  it('keeps an add made before a bulk removal of the selection', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(objects, { onChange }));

    act(() => result.current.selection.toggle(1, false));
    act(() => {
      result.current.actions.add();
      result.current.actions.removeSelected();
    });

    const last = onChange.mock.calls.at(-1)![0] as string;

    expect(last).not.toContain("key: 'b'");
    expect(last.match(/label: 'Alpha'/g)).toHaveLength(2);
    expect(last).toContain("key: 'c'");
  });

  // Once a render has happened, the rendered `value` wins again, even when
  // the host didn't take the earlier commit.
  it('drops an unaccepted commit once the next render arrives', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDndItems(objects, { onChange }));

    act(() => result.current.actions.add());
    act(() => result.current.actions.add());

    // Each add is one copy on top of the rendered three, not two in a row.
    for (const [next] of onChange.mock.calls) {
      expect((next as string).match(/label: 'Alpha'/g)).toHaveLength(2);
    }
  });
});
