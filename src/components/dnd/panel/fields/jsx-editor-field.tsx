import { type FocusEvent, useCallback, useRef } from 'react';

import type {
  EditorSelection,
  EditorView,
  ViewUpdate,
} from '@uiw/react-codemirror';

import CoreEditor from '~/components/editor/core';

interface Props {
  value: string;
  isHTML: boolean;
  onSave: (value: string) => void;
}

// Keeps focus and selection when CodeMirror recreates its view, which
// `@uiw/react-codemirror` does when a moved item's effects reconnect under
// Strict Effects (#359).
const JSXEditorField = ({ value, isHTML, onSave }: Props) => {
  const selectionRef = useRef<EditorSelection | null>(null);
  const focusedRef = useRef(false);

  const handleUpdate = useCallback((update: ViewUpdate) => {
    selectionRef.current = update.state.selection;
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

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (
      event.relatedTarget &&
      !event.currentTarget.contains(event.relatedTarget as Node)
    ) {
      focusedRef.current = false;
    }
  }, []);

  return (
    <div onFocusCapture={handleFocus} onBlurCapture={handleBlur}>
      <CoreEditor
        value={value}
        height="150px"
        fragment={!isHTML}
        raw={isHTML}
        onSave={onSave}
        onUpdate={handleUpdate}
        onCreateEditor={handleCreateEditor}
      />
    </div>
  );
};

export default JSXEditorField;
