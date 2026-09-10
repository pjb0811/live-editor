// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useItemsEditor } from './use-items-editor';

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

describe('useItemsEditor derivation', () => {
  it('resolves object items to PanelBindings, no AST types leaking out', () => {
    const { result } = renderHook(() => useItemsEditor(objects));

    expect(result.current.kind).toBe('object');
    expect(result.current.items).toHaveLength(3);

    const first = result.current.items[0]!;
    expect(first.properties.map(p => p.label)).toEqual(['key', 'label']);
    expect(first.properties[0]!.rawValue).toBe('a');
    expect(typeof first.properties[0]!.onChange).toBe('function');
  });

  it('exposes a primitive array as one binding per item', () => {
    const { result } = renderHook(() => useItemsEditor(primitives));

    expect(result.current.kind).toBe('primitive');
    expect(result.current.items.map(i => i.value!.rawValue)).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(result.current.items[0]!.properties).toEqual([]);
  });

  it('finds data-bound elements nested inside a JSX-valued property', () => {
    const { result } = renderHook(() => useItemsEditor(nested));

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
    const { result } = renderHook(() =>
      useItemsEditor(nested, { onNodeChange }),
    );

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
    const { result } = renderHook(() => useItemsEditor('not an array'));

    expect(result.current.parseError).toBe(true);
    expect(result.current.items).toEqual([]);
  });
});

describe('useItemsEditor mutations', () => {
  it('adds, removes and moves through the array source', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useItemsEditor(objects, { onChange }));

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
    const { result } = renderHook(() => useItemsEditor(objects));

    act(() => result.current.selection.toggle(0, false));
    expect(result.current.selection.selected.size).toBe(1);

    act(() => result.current.actions.move(0, 1));
    expect(result.current.selection.selected.size).toBe(0);
  });

  it('clears the selection after a delete', () => {
    const { result } = renderHook(() => useItemsEditor(objects));

    act(() => result.current.selection.toggle(2, false));
    act(() => result.current.actions.remove(0));

    expect(result.current.selection.selected.size).toBe(0);
  });

  it('translates selection indices to element positions for bulk actions', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useItemsEditor(objects, { onChange }));

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
    const { result } = renderHook(() => useItemsEditor(objects));

    act(() => result.current.selection.toggle(1, false));
    act(() => result.current.actions.moveSelected('up'));

    // Not cleared — the items are still selected, at their new positions.
    expect([...result.current.selection.selected]).toEqual([0]);
  });
});
