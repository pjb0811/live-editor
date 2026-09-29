import { useState } from 'react';

import { Button, Layout, Radio, Space, Splitter, Toast } from '@jbpark/ui-kit';
import {
  useDebounce,
  useHistoryState,
  useKeyPress,
  useLocalStorage,
  useResponsiveSize,
} from '@jbpark/use-hooks';
import { Redo2, Save, Undo2 } from 'lucide-react';

import './index.css';

import Live from '../../';
import {
  DEFAULT_TEMPLATE,
  DRAGGABLE_ITEMS,
  STORAGE_KEY,
} from '../../constants';
import DiffModal from './diff-modal';
import { SECTION_ROOT_EXAMPLE } from './section-root-example';

// The default palette plus a Banner whose own `<section>` carries a
// `data-binding`, to try section-root bindings (#429) by hand.
const PALETTE = [...DRAGGABLE_ITEMS, SECTION_ROOT_EXAMPLE];

const options = [
  { label: 'Drag & Drop', value: 'dnd' },
  { label: 'Editor', value: 'editor' },
];

const App = () => {
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
  const [type, setType] = useState<'dnd' | 'editor'>('editor');
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const hasUnsavedChanges = value !== savedValue;

  const { breakpoint } = useResponsiveSize();
  const isMobile = breakpoint.current === 'xs' || breakpoint.current === 'sm';

  const editable = type === 'editor';

  const previewFrame = {
    mode: 'iframe' as const,
    syncStyle: true,
    scripts: ['/js/tailwindcss.js'],
  };

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
    <>
      {/*
        A viewport-sized app shell: `h-dvh` caps the height ui-kit's Layout
        would otherwise only floor (its root is `min-h-screen`, so the
        content's intrinsic height used to grow the document instead), and
        `overflow-hidden` keeps a stray child from scrolling the shell. This
        replaces the old `calc(100vh - 80px)` on the content box — the header
        height no longer has to be hard-coded anywhere.
      */}
      <Layout className="h-dvh overflow-hidden">
        <Layout.Header position="static" className="h-12 justify-end p-2">
          <Space>
            <Radio.Group
              size="small"
              value={type}
              options={options}
              optionType="button"
              buttonStyle="solid"
              onChange={value => setType(value as 'dnd' | 'editor')}
            />
            <Button
              icon={<Undo2 size={16} />}
              disabled={!canUndo}
              onClick={undo}
            />
            <Button
              icon={<Redo2 size={16} />}
              disabled={!canRedo}
              onClick={redo}
            />
            <Button
              icon={<Save size={16} />}
              type="primary"
              disabled={!hasUnsavedChanges}
              onClick={() => setDiffModalOpen(true)}
            />
          </Space>
        </Layout.Header>

        {/*
          `min-h-0` lets this flex child shrink below its content's intrinsic
          height, so the leftover space after the header is a definite height
          the Splitter and the DnD canvas can fill with `h-full` — and their
          own panes take the overflow instead of the document.
        */}
        <Layout.Content className="min-h-0 p-2">
          <Live>
            {editable ? (
              <Splitter
                withHandle
                orientation={isMobile ? 'vertical' : 'horizontal'}
              >
                <Splitter.Panel
                  defaultSize="50%"
                  minSize="20%"
                  maxSize="80%"
                  collapsible
                >
                  <div className="h-full overflow-auto p-2">
                    <Live.Preview showError frame={previewFrame} />
                  </div>
                </Splitter.Panel>
                <Splitter.Panel collapsible>
                  <Live.Editor value={value} onChange={setValue} />
                </Splitter.Panel>
              </Splitter>
            ) : (
              <Live.Dnd
                frame={previewFrame}
                items={PALETTE}
                value={value}
                onChange={setValue}
              />
            )}
          </Live>
        </Layout.Content>
      </Layout>
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
    </>
  );
};

export default App;
