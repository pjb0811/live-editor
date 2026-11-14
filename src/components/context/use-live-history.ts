import { useCallback, useRef } from 'react';

import { useHistoryState, useKeyPress, useLatest } from '@jbpark/use-hooks';

// Where a change passed to `onChange` came from (#749).
export interface LiveChange {
  // `'dnd'`: one complete edit from `Live.Dnd`: a panel field, a drop, a
  // move, a copy or a delete. `'editor'`: text typed in `Live.Editor`,
  // possibly one of many in a row.
  source: 'dnd' | 'editor';
}

export interface LiveHistoryOptions {
  // How many undo steps to keep; the oldest go first. Default 100.
  limit?: number;
  // `'editor'` changes less than this many milliseconds apart are one undo
  // step. Default 500.
  mergeWindow?: number;
  // Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z and Ctrl+Y redo, except while focus
  // is in a text field or the code editor, which keep their own text undo.
  // Default `true`.
  shortcuts?: boolean;
}

export interface LiveHistory {
  value: string;
  // For `Live.Dnd` and `Live.Editor`'s `onChange`. Records the change by its
  // source; without one, it's one step.
  onChange: (value: string, change?: LiveChange) => void;
  // A change of the host's own, such as applying a template: one step.
  set: (value: string) => void;
  // Replaces the document and clears the history, such as when opening
  // another document.
  reset: (value: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Where the shortcuts don't apply: the panel's inputs and the code editor
// undo their own text.
const TEXT_TARGETS = 'input, textarea, select, [contenteditable], .cm-editor';

// Undo and redo for a document edited with `Live.Dnd` and `Live.Editor`.
// Pass `value` and `onChange` to both: each canvas edit is one step, and a
// burst of typing in the code editor is one step too.
export const useLiveHistory = (
  initialValue: string,
  { limit = 100, mergeWindow = 500, shortcuts = true }: LiveHistoryOptions = {},
): LiveHistory => {
  const history = useHistoryState(initialValue, { limit });
  const {
    setValue,
    replace,
    undo: undoHistory,
    redo: redoHistory,
    reset: resetHistory,
  } = history;

  // When the last `'editor'` change of the running burst happened, or `null`
  // when no burst is running. A burst's first change adds a step, so the
  // value before typing can be restored; the rest replace that step.
  const lastTypedAtRef = useRef<number | null>(null);
  const valueRef = useLatest(history.value);

  const onChange = useCallback(
    (next: string, change?: LiveChange) => {
      // Nothing changed, and a burst isn't started by it either.
      if (next === valueRef.current) {
        return;
      }

      if (change?.source !== 'editor') {
        lastTypedAtRef.current = null;
        setValue(next);

        return;
      }

      const now = Date.now();
      const last = lastTypedAtRef.current;

      lastTypedAtRef.current = now;

      if (last !== null && now - last < mergeWindow) {
        replace(next);

        return;
      }

      setValue(next);
    },
    [mergeWindow, replace, setValue, valueRef],
  );

  // Every action outside a burst ends it, so the next keystroke starts a new
  // step instead of replacing an undone or restored one.
  const set = useCallback(
    (next: string) => {
      lastTypedAtRef.current = null;
      setValue(next);
    },
    [setValue],
  );

  const reset = useCallback(
    (next: string) => {
      lastTypedAtRef.current = null;
      resetHistory(next);
    },
    [resetHistory],
  );

  const undo = useCallback(() => {
    lastTypedAtRef.current = null;
    undoHistory();
  }, [undoHistory]);

  const redo = useCallback(() => {
    lastTypedAtRef.current = null;
    redoHistory();
  }, [redoHistory]);

  useKeyPress('mod+z', undo, {
    enabled: shortcuts,
    ignore: TEXT_TARGETS,
    preventDefault: true,
  });
  useKeyPress(['mod+shift+z', 'ctrl+y'], redo, {
    enabled: shortcuts,
    ignore: TEXT_TARGETS,
    preventDefault: true,
  });

  return {
    value: history.value,
    onChange,
    set,
    reset,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
};
