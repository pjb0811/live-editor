import { useState } from 'react';

import { Button, Space, Toast } from '@jbpark/ui-kit';
import { useLocalStorage } from '@jbpark/use-hooks';
import { Redo2, Save, Undo2 } from 'lucide-react';

import {
  createUiKitDocument,
  uiKitFields,
  uiKitModules,
  uiKitPaletteSections,
} from '~/components/ui-kit';
import { STORAGE_KEY } from '~/constants';
import Live, { useLiveHistory } from '~/index';

import { EditorView, ModeSwitch, type ViewMode } from '../shared/editor-view';
import { IFRAME_FRAME } from '../shared/frames';
import { SECTION_ROOT_EXAMPLE } from '../shared/section-root-example';
import DiffModal from './diff-modal';

// The default palette plus a Banner whose own `<section>` carries a
// `data-binding`, to try section-root bindings (#429) by hand.
const PALETTE = [...uiKitPaletteSections, SECTION_ROOT_EXAMPLE];

// The whole editing loop on one document: the code editor and the Dnd
// canvas edit the same value, with undo/redo across both and a reviewed save
// to localStorage.
const Playground = () => {
  const [savedValue, setSavedValue] = useLocalStorage(
    STORAGE_KEY,
    createUiKitDocument(),
  );

  // Undo and redo across both editors, with Cmd/Ctrl+Z bound outside text
  // fields and the code editor (#749).
  const { value, onChange, undo, redo, canUndo, canRedo } =
    useLiveHistory(savedValue);
  const [type, setType] = useState<ViewMode>('dnd');
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const hasUnsavedChanges = value !== savedValue;

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
            <EditorView value={value} onChange={onChange} />
          ) : (
            <Live.Dnd
              modules={uiKitModules}
              frame={IFRAME_FRAME}
              renderField={uiKitFields}
              items={PALETTE}
              value={value}
              onChange={onChange}
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
