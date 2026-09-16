// @vitest-environment jsdom
import { useState } from 'react';

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { extract, update } from '~/utils/ast';

import { useChildrenEditor } from './use-children-editor';

const source = `<div data-id="parent" data-binding={[{label:'Children',property:'children'}]}><p data-id="a">A</p>{flag && <em>keep</em>}<p data-id="b">B</p><p data-id="c">C</p></div>`;
const nodes = (code: string) => extract(code)[0]!.children ?? [];

const useHarness = () => {
  const [code, setCode] = useState(source);
  const editor = useChildrenEditor(nodes(code), {
    onChange: value => {
      const result = update(code, 'parent', 'Children', value, 'children');

      if (result.success) {
        setCode(result.code);
      }
    },
  });

  return { code, setCode, ...editor };
};

describe('useChildrenEditor', () => {
  it.each(['move', 'remove'] as const)(
    'clears stale selection after single-row %s and prevents a later bulk delete from removing another child',
    action => {
      const { result } = renderHook(useHarness);

      act(() => result.current.selection.toggle(1, false));
      expect([...result.current.selection.selected]).toEqual([1]);
      act(() => {
        if (action === 'move') {
          result.current.actions.move(0, 2);
        } else {
          result.current.actions.remove(0);
        }
      });
      expect(result.current.selection.selected.size).toBe(0);
      const after = result.current.code;
      act(() => result.current.actions.removeSelected());

      expect(result.current.code).toBe(after);
      expect(result.current.code).toContain('data-id="b"');
      expect(result.current.code).toContain('data-id="c"');
      expect(result.current.code).toContain('{flag && <em>keep</em>}');
    },
  );

  it('keeps selection on rejected edits or until a controlled host accepts the result', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ code }) => useChildrenEditor(nodes(code), { onChange }),
      { initialProps: { code: source } },
    );

    act(() => result.current.selection.toggle(1, false));
    act(() => result.current.actions.move(0, 2));
    expect(result.current.selection.selected.size).toBe(1);
    const accepted = update(
      source,
      'parent',
      'Children',
      onChange.mock.calls[0]![0],
      'children',
    );
    rerender({ code: accepted.code });

    expect(result.current.selection.selected.size).toBe(0);
  });

  it('clears selection on external edits and undo, including same-length lists', () => {
    const { result } = renderHook(useHarness);

    act(() => result.current.selection.toggle(1, false));
    act(() => result.current.setCode(source.replace('>A</p>', '>Changed</p>')));
    expect(result.current.selection.selected.size).toBe(0);
    act(() => result.current.selection.toggle(0, false));
    act(() => result.current.setCode(source));
    expect(result.current.selection.selected.size).toBe(0);
  });

  it('duplicates selected source in order with fresh IDs then accepts another selection', () => {
    const { result } = renderHook(useHarness);

    act(() => result.current.selection.toggle(1, false));
    act(() => result.current.actions.duplicateSelected());
    expect(result.current.items).toHaveLength(4);
    expect(result.current.selection.selected.size).toBe(0);
    expect(result.current.items[3]!.source).toMatch(
      /<p data-id="(?!b")[^"]+">B<\/p>/,
    );
    act(() => result.current.selection.toggle(3, false));
    act(() => result.current.actions.moveSelected('up'));
    expect(result.current.items[2]!.source).toContain('>B</p>');
    expect(result.current.items[3]!.source).toContain('>C</p>');
  });
});
