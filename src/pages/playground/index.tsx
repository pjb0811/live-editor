import { useState } from 'react';

import { Button, Space, Toast } from '@jbpark/ui-kit';
import {
  useDebounce,
  useHistoryState,
  useKeyPress,
  useLocalStorage,
} from '@jbpark/use-hooks';
import { Redo2, Save, Undo2 } from 'lucide-react';

import { DEFAULT_TEMPLATE, PALETTE_SECTIONS, STORAGE_KEY } from '~/constants';
import Live from '~/index';

import { EditorView, ModeSwitch, type ViewMode } from '../shared/editor-view';
import { IFRAME_FRAME } from '../shared/frames';
import { SECTION_ROOT_EXAMPLE } from '../shared/section-root-example';
import DiffModal from './diff-modal';

// The default palette plus a Banner whose own `<section>` carries a
// `data-binding`, to try section-root bindings (#429) by hand.
const PALETTE = [...PALETTE_SECTIONS, SECTION_ROOT_EXAMPLE];

// The whole editing loop on one document: the code editor and the Dnd
// canvas edit the same value, with undo/redo across both and a reviewed save
// to localStorage.
const Playground = () => {
  const [savedValue, setSavedValue] = useLocalStorage(
    STORAGE_KEY,
    DEFAULT_TEMPLATE,
  );

  const [value, setValue] = useState(savedValue);
  const {
    value: historyValue,
    setValue: commitHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistoryState(value);
  const [type, setType] = useState<ViewMode>('dnd');
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const hasUnsavedChanges = value !== savedValue;

  // Commit to undo/redo history only after edits settle, so rapid typing in
  // the raw editor doesn't create a history entry per keystroke.
  useDebounce(
    () => {
      commitHistory(value);
    },
    { delay: 500 },
    [value],
  );

  // Reflect undo/redo (or the debounced commit above catching up) back into
  // the editable value. Adjusted directly in render (React's "adjust state
  // during render" pattern) instead of an effect, so it lands in the same
  // render `historyValue` changes rather than the render after.
  const [prevHistoryValue, setPrevHistoryValue] = useState(historyValue);

  if (historyValue !== prevHistoryValue) {
    setPrevHistoryValue(historyValue);
    setValue(historyValue);
  }

  // Let CodeMirror's own text-level undo/redo handle keystrokes inside the
  // raw editor instead of triggering the history-level undo/redo here.
  useKeyPress('mod+z', undo, { ignore: '.cm-editor', preventDefault: true });
  useKeyPress('mod+shift+z', redo, {
    ignore: '.cm-editor',
    preventDefault: true,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end border-b border-gray-200 px-2 py-1.5">
        <Space>
          <ModeSwitch value={type} onChange={setType} />
          <Button
            size="small"
            aria-label="Undo"
            icon={<Undo2 size={14} />}
            disabled={!canUndo}
            onClick={undo}
          />
          <Button
            size="small"
            aria-label="Redo"
            icon={<Redo2 size={14} />}
            disabled={!canRedo}
            onClick={redo}
          />
          <Button
            size="small"
            aria-label="Review and save"
            icon={<Save size={14} />}
            type="primary"
            disabled={!hasUnsavedChanges}
            onClick={() => setDiffModalOpen(true)}
          />
        </Space>
      </div>
      <div className="min-h-0 flex-1 p-2">
        <Live>
          {type === 'editor' ? (
            <EditorView value={value} onChange={setValue} />
          ) : (
            <Live.Dnd
              frame={IFRAME_FRAME}
              items={PALETTE}
              value={value}
              onChange={setValue}
            />
          )}
        </Live>
      </div>
      <DiffModal
        open={diffModalOpen}
        original={savedValue}
        current={value}
        onConfirm={() => {
          setSavedValue(value);
          setDiffModalOpen(false);
          Toast.success('Code saved successfully');
        }}
        onCancel={() => setDiffModalOpen(false)}
      />
    </div>
  );
};

export default Playground;
