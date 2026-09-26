import { useState } from 'react';

import { useMultiSelect } from '@jbpark/use-hooks';

import type { ChildrenAction } from '~/utils/ast';
import { moveSelectedIndices } from '~/utils/selection';

// The structural commands both list editors issue (#342). Children sends them
// to the AST layer as-is; Items translates them to array element positions.
export type StructuralCommand = ChildrenAction;

// Where the selection stands after a command succeeds. Commands that leave
// every existing position in place keep it; a bulk move carries the block to
// its new positions; anything else shifts positions under the selection, so
// it is cleared rather than left pointing at different items (#285).
export const selectionAfter = (
  command: StructuralCommand,
  selected: ReadonlySet<number>,
  count: number,
): Set<number> => {
  switch (command.type) {
    case 'append':
    case 'duplicate':
      // Both add at the end, so no existing item moves.
      return new Set(selected);
    case 'move-selected':
      return moveSelectedIndices(
        Array.from({ length: count }, (_, index) => index),
        new Set(command.indices),
        command.direction,
      ).indices;
    default:
      return new Set();
  }
};

interface Pending {
  // Recognizes the source this command produced, as opposed to one that
  // came from somewhere else (another field, undo, an external edit).
  matches: (revision: string) => boolean;
  selection: Set<number>;
}

export interface RecordOptions {
  // Apply the selection now as well, for a caller that already knows the
  // command succeeded. Otherwise it applies when the source arrives.
  now?: boolean;
}

// Positional multi-selection for a list whose source can change under it.
// `revision` identifies the current source. When it changes to the source a
// recorded command produced, that command's selection applies; when it
// changes for any other reason, the selection is cleared, since positions in
// an unrelated source no longer name the same items. A refused command
// produces no new source, so it changes nothing.
export const useStructuralSelection = (count: number, revision: string) => {
  const selection = useMultiSelect(count);
  const [seen, setSeen] = useState(revision);
  const [pending, setPending] = useState<Pending | null>(null);

  // Adjusted during render rather than in an effect, so a frame with the
  // previous source's selection never paints.
  if (revision !== seen) {
    setSeen(revision);
    setPending(null);

    if (pending?.matches(revision) && pending.selection.size > 0) {
      selection.replace(pending.selection);
    } else {
      selection.clear();
    }
  }

  const record = (
    next: Set<number>,
    matches: Pending['matches'],
    { now = false }: RecordOptions = {},
  ) => {
    setPending({ matches, selection: next });

    if (!now) {
      return;
    }

    // `clear` also drops the shift-range anchor, which `replace` keeps.
    if (next.size > 0) {
      selection.replace(next);
    } else {
      selection.clear();
    }
  };

  return { selection, record };
};
