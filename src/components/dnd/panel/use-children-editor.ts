import { useEffect, useMemo } from 'react';

import { useMultiSelect } from '@jbpark/use-hooks';

import {
  type ChildrenAction,
  type ChildrenEdit,
  type DataAttrNode,
  getChildrenSignatures,
} from '~/utils/ast';

export interface ChildrenEditorOptions {
  onChange?: (value: string) => void;
}

// Domain adapter: serializes a structural command for the existing binding
// onChange/update path. The AST layer owns source validation and mutation.
export const useChildrenEditor = (
  items: DataAttrNode[],
  { onChange }: ChildrenEditorOptions = {},
) => {
  const selection = useMultiSelect(items.length);
  const expected = useMemo(() => getChildrenSignatures(items), [items]);
  const revision = JSON.stringify(expected);
  const clear = selection.clear;

  // Reconcile only once new source arrives: rejected edits leave selection
  // intact, and external edits/undo cannot leave stale positional targets.
  useEffect(() => {
    clear();
  }, [revision, clear]);

  const commit = (action: ChildrenAction) => {
    const edit: ChildrenEdit = { kind: 'children-edit', expected, action };

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
