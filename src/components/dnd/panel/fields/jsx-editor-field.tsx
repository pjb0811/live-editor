import { type FocusEvent, useCallback, useRef } from 'react';

import { useLatest } from '@jbpark/use-hooks';
import type {
  EditorSelection,
  EditorView,
  ViewUpdate,
} from '@uiw/react-codemirror';

import CoreEditor from '~/components/editor/core';

interface Props {
  value: string;
  // Saves the text as typed: no Prettier on Cmd/Ctrl+S. For `innerHTML` and
  // a function's source, which Prettier would format as a JSX fragment.
  raw: boolean;
  onSave: (value: string) => void;
}

// A source editor for an `innerHTML`, `jsx` or `function` binding. Saves
// when focus leaves it, like the other fields, and on Cmd/Ctrl+S, which also
// formats a `jsx` value (#711).
//
// Keeps focus and selection when CodeMirror recreates its view, which
// `@uiw/react-codemirror` does when a moved item's effects reconnect under
// Strict Effects (#359).
const JSXEditorField = ({ value, raw, onSave }: Props) => {
  const onSaveRef = useLatest(onSave);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<EditorSelection | null>(null);
  const focusedRef = useRef(false);
  const textRef = useRef(value);

  const handleUpdate = useCallback((update: ViewUpdate) => {
    selectionRef.current = update.state.selection;

    if (update.docChanged) {
      textRef.current = update.state.doc.toString();
    }
  }, []);

  const handleCreateEditor = useCallback((view: EditorView) => {
    if (selectionRef.current) {
      view.dispatch({ selection: selectionRef.current });
    }

    if (focusedRef.current) {
      view.focus();
    }
  }, []);

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (
        event.relatedTarget &&
        !event.currentTarget.contains(event.relatedTarget as Node)
      ) {
        focusedRef.current = false;
      }

      // Checked once the blur is over: a recreated view takes focus back
      // in the same task, which isn't leaving the field.
      setTimeout(() => {
        const wrapper = wrapperRef.current;

        if (!wrapper || wrapper.contains(document.activeElement)) {
          return;
        }

        onSaveRef.current(textRef.current);
      }, 0);
    },
    [onSaveRef],
  );

  return (
    <div
      ref={wrapperRef}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
      <CoreEditor
        value={value}
        height="150px"
        fragment={!raw}
        raw={raw}
        onSave={onSave}
        onUpdate={handleUpdate}
        onCreateEditor={handleCreateEditor}
      />
    </div>
  );
};

export default JSXEditorField;
