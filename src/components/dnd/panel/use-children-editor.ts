import { useMemo } from 'react';

import {
  type ChildrenAction,
  type ChildrenEdit,
  type DataAttrNode,
  getChildrenSignatures,
} from '~/utils/ast';
import { moveSelectedIndices } from '~/utils/selection';

import {
  selectionAfter,
  useStructuralSelection,
} from './use-structural-selection';

export interface ChildrenEditorOptions {
  onChange?: (value: string) => void;
}

// The signature list a successful command produces, as far as it can be
// known up front: a reorder is a permutation of the current signatures, and
// an append or duplicate leaves them all in place as a prefix. Lets the
// selection tell this command's result apart from an unrelated edit.
const producedBy = (
  expected: string[],
  action: ChildrenAction,
): ((revision: string) => boolean) => {
  if (action.type === 'move-selected') {
    const moved = JSON.stringify(
      moveSelectedIndices(expected, new Set(action.indices), action.direction)
        .items,
    );

    return revision => revision === moved;
  }

  const added =
    action.type === 'append'
      ? 1
      : action.type === 'duplicate'
        ? action.indices.length
        : 0;

  return revision => {
    const next = JSON.parse(revision) as string[];

    return (
      next.length === expected.length + added &&
      expected.every((signature, index) => next[index] === signature)
    );
  };
};

// Domain adapter: serializes a structural command for the existing binding
// onChange/update path. The AST layer owns source validation and mutation;
// selection follows the shared rule in useStructuralSelection.
export const useChildrenEditor = (
  items: DataAttrNode[],
  { onChange }: ChildrenEditorOptions = {},
) => {
  const expected = useMemo(() => getChildrenSignatures(items), [items]);
  const revision = JSON.stringify(expected);
  const { selection, record } = useStructuralSelection(items.length, revision);

  // The outcome is only known when new source arrives, so the selection is
  // recorded here and applied then. A rejected edit produces no new source
  // and leaves the selection as it was.
  const commit = (action: ChildrenAction) => {
    const edit: ChildrenEdit = { kind: 'children-edit', expected, action };
    const next = selectionAfter(action, selection.selected, items.length);

    if (next.size > 0) {
      record(next, producedBy(expected, action));
    }

    onChange?.(JSON.stringify(edit));
  };

  return {
    items,
    selection,
    actions: {
      move: (from: number, to: number) => commit({ type: 'move', from, to }),
      remove: (index: number) => commit({ type: 'remove', indices: [index] }),
      add: () => commit({ type: 'append' }),
      duplicateSelected: () =>
        commit({ type: 'duplicate', indices: [...selection.selected] }),
      moveSelected: (direction: 'up' | 'down') =>
        commit({
          type: 'move-selected',
          indices: [...selection.selected],
          direction,
        }),
      removeSelected: () =>
        commit({ type: 'remove', indices: [...selection.selected] }),
    },
  };
};

export type ChildrenEditor = ReturnType<typeof useChildrenEditor>;
