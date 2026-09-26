// @vitest-environment jsdom
import { useState } from 'react';

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { extract, update } from '~/utils/ast';

import { DndEditOptionsContext } from '../edit-options';
import { useChildrenEditor } from './use-children-editor';
import { useItemsEditor } from './use-items-editor';

// One contract for both structural editors (#342): after a command succeeds,
// the selection is whatever that command's rule says; after anything else
// changes the source (another field, undo, an external edit), positional
// selection is cleared; after a refused command, nothing changes.

const childrenSource = `<div data-id="parent" data-binding={[{label:'Children',property:'children'}]}><p data-id="a">A</p><p data-id="b">B</p><p data-id="c">C</p><p data-id="d">D</p></div>`;
const childrenOf = (code: string) => extract(code)[0]!.children ?? [];
const itemsSource = `[{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }]`;

// The same surface for both hooks, so each case below runs against both.
interface Harness {
  code: string;
  setCode: (code: string) => void;
  selected: number[];
  toggle: (index: number) => void;
  add: () => void;
  move: (from: number, to: number) => void;
  remove: (index: number) => void;
  duplicateSelected: () => void;
  moveSelected: (direction: 'up' | 'down') => void;
  removeSelected: () => void;
  labels: () => string[];
}

const useChildrenHarness = (): Harness => {
  const [code, setCode] = useState(childrenSource);
  const editor = useChildrenEditor(childrenOf(code), {
    onChange: value => {
      const result = update(code, 'parent', 'Children', value, 'children');

      if (result.success) {
        setCode(result.code);
      }
    },
  });

  return {
    code,
    setCode,
    selected: [...editor.selection.selected].sort(),
    toggle: index => editor.selection.toggle(index, false),
    add: editor.actions.add,
    move: editor.actions.move,
    remove: editor.actions.remove,
    duplicateSelected: editor.actions.duplicateSelected,
    moveSelected: editor.actions.moveSelected,
    removeSelected: editor.actions.removeSelected,
    labels: () =>
      [...code.matchAll(/<p data-id="[^"]+">(\w)<\/p>/g)].map(m => m[1]!),
  };
};

const useItemsHarness = (): Harness => {
  const [code, setCode] = useState(itemsSource);
  const editor = useItemsEditor(code, { onChange: setCode });

  return {
    code,
    setCode,
    selected: [...editor.selection.selected].sort(),
    toggle: index => editor.selection.toggle(index, false),
    add: editor.actions.add,
    move: (from, to) =>
      editor.actions.move(editor.items[from]!.elementIndex, to),
    remove: index => editor.actions.remove(editor.items[index]!.elementIndex),
    duplicateSelected: editor.actions.duplicateSelected,
    moveSelected: editor.actions.moveSelected,
    removeSelected: editor.actions.removeSelected,
    labels: () => [...code.matchAll(/label: '(\w)'/g)].map(m => m[1]!),
  };
};

const render = (useHarness: () => Harness) =>
  renderHook(useHarness, {
    wrapper: ({ children }) => (
      <DndEditOptionsContext.Provider value={{ reportError: () => {} }}>
        {children}
      </DndEditOptionsContext.Provider>
    ),
  });

describe.each([
  ['children', useChildrenHarness],
  ['items', useItemsHarness],
] as const)('%s structural edits', (_name, useHarness) => {
  it('keeps a moved block selected, so it can be moved again', () => {
    const { result } = render(useHarness);

    act(() => result.current.toggle(2));
    act(() => result.current.toggle(3));
    act(() => result.current.moveSelected('up'));

    expect(result.current.labels()).toEqual(['A', 'C', 'D', 'B']);
    expect(result.current.selected).toEqual([1, 2]);

    act(() => result.current.moveSelected('up'));

    expect(result.current.labels()).toEqual(['C', 'D', 'A', 'B']);
    expect(result.current.selected).toEqual([0, 1]);
  });

  it('keeps the selection on the originals after duplicating them', () => {
    const { result } = render(useHarness);

    act(() => result.current.toggle(1));
    act(() => result.current.duplicateSelected());

    expect(result.current.labels()).toEqual(['A', 'B', 'C', 'D', 'B']);
    expect(result.current.selected).toEqual([1]);
  });

  it('keeps the selection when an item is added at the end', () => {
    const { result } = render(useHarness);

    act(() => result.current.toggle(1));
    act(() => result.current.add());

    expect(result.current.labels()).toHaveLength(5);
    expect(result.current.selected).toEqual([1]);
  });

  it.each(['move', 'remove'] as const)(
    'clears the selection after a single-row %s',
    action => {
      const { result } = render(useHarness);

      act(() => result.current.toggle(3));
      act(() =>
        action === 'move'
          ? result.current.move(0, 2)
          : result.current.remove(0),
      );

      expect(result.current.selected).toEqual([]);
    },
  );

  // Positions in an unrelated new source no longer name the same items, so
  // a later bulk action must not act on them.
  it('clears the selection when the source changes from outside', () => {
    const { result } = render(useHarness);

    act(() => result.current.toggle(0));

    const reordered = result.current.code
      .replace('A', '#')
      .replace('D', 'A')
      .replace('#', 'D');

    act(() => result.current.setCode(reordered));

    expect(result.current.selected).toEqual([]);

    const before = result.current.code;

    act(() => result.current.removeSelected());

    expect(result.current.code).toBe(before);
  });
});

describe('items value edits', () => {
  // Typing into a field moves nothing, so it is not the kind of source
  // change that invalidates positions.
  it('keeps the selection through an edit to an item value', () => {
    const { result } = renderHook(() => {
      const [code, setCode] = useState(itemsSource);

      return { code, editor: useItemsEditor(code, { onChange: setCode }) };
    });

    act(() => result.current.editor.selection.toggle(2, false));
    act(() => result.current.editor.items[0]!.properties[0]!.onChange('Z'));

    expect(result.current.code).toContain('"Z"');
    expect([...result.current.editor.selection.selected]).toEqual([2]);
  });
});
