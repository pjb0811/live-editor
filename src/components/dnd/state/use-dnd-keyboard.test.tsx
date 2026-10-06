// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Section } from '~/types';

import { useDndKeyboard } from './use-dnd-keyboard';

const sections: Section[] = ['a', 'b', 'c'].map(id => ({
  id,
  name: id.toUpperCase(),
  code: '<section />',
}));

const setup = (
  overrides: Partial<Parameters<typeof useDndKeyboard>[0]> = {},
) => {
  const selectOnly = vi.fn();
  const move = vi.fn();
  const options = {
    sections,
    selectedId: null,
    selectedIndex: -1,
    selectOnly,
    move,
    requestDelete: vi.fn(),
    ...overrides,
  };
  const { result } = renderHook(() => useDndKeyboard(options));
  const nodes = Object.fromEntries(
    sections.map(section => {
      const node = document.createElement('div');

      node.focus = vi.fn();
      result.current.sectionNodes.register(section.id)(node);

      return [section.id, node];
    }),
  );

  return { result, nodes, selectOnly, move };
};

describe('useDndKeyboard', () => {
  it('moves selection and focus to the section the key names', () => {
    const { result, selectOnly, nodes } = setup();

    result.current.onNavigate('a', 'next');
    result.current.onNavigate('a', 'last');

    expect(selectOnly.mock.calls).toEqual([['b'], ['c']]);
    expect(nodes.c!.focus).toHaveBeenCalled();
  });

  it('stays put past either end and for an unknown section', () => {
    const { result, selectOnly } = setup();

    result.current.onNavigate('a', 'previous');
    result.current.onNavigate('c', 'next');
    result.current.onNavigate('a', 'first');
    result.current.onNavigate('missing', 'next');

    expect(selectOnly).not.toHaveBeenCalled();
  });

  it('moves focus to the next section after a Delete, or the previous for the last', () => {
    const requestDelete = vi.fn((_id: string, onDeleted?: () => void) =>
      onDeleted?.(),
    );
    const { result, nodes } = setup({ requestDelete });

    result.current.onDeleteKey('b');
    expect(nodes.c!.focus).toHaveBeenCalledTimes(1);

    result.current.onDeleteKey('c');
    expect(nodes.b!.focus).toHaveBeenCalledTimes(1);
  });

  it('focuses the section only when a move button reaches an end (#505)', () => {
    const { result, move, nodes } = setup();

    result.current.onMoveButton('c', 'up');
    expect(nodes.c!.focus).not.toHaveBeenCalled();

    result.current.onMoveButton('b', 'up');
    result.current.onMoveButton('b', 'down');

    expect(move.mock.calls).toEqual([
      ['c', 'up'],
      ['b', 'up'],
      ['b', 'down'],
    ]);
    expect(nodes.b!.focus).toHaveBeenCalledTimes(2);
  });

  it('announces drags by section name and position', () => {
    const { result } = setup();
    const active = { id: 'a', data: { current: undefined } };

    expect(
      result.current.announcements.onDragOver!({
        active,
        over: { id: 'c' },
      } as never),
    ).toBe('A moved to position 3 of 3.');
    expect(
      result.current.announcements.onDragEnd!({ active, over: null } as never),
    ).toBe('A dropped.');
  });
});
