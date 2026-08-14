import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  EyeOutlined,
  RedoOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  useDebounce,
  useHistoryState,
  useKeyPress,
  useLocalStorage,
  useResponsiveSize,
} from '@jbpark/use-hooks';
import { Button, Flex, Radio, Space, Splitter, message } from 'antd';

import Live from '../../';
import { DEFAULT_TEMPLATE, STORAGE_KEY } from '../../constants';
import DiffModal from './diff-modal';

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

  const navigate = useNavigate();

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
      <Flex gap="middle" vertical className="h-full">
        <Flex justify="end">
          <Space className="p-2">
            <Radio.Group
              size="small"
              value={type}
              options={options}
              optionType="button"
              buttonStyle="solid"
              onChange={e => setType(e.target.value)}
            />
            <Button
              icon={<UndoOutlined />}
              disabled={!canUndo}
              onClick={undo}
            />
            <Button
              icon={<RedoOutlined />}
              disabled={!canRedo}
              onClick={redo}
            />
            <Button
              icon={<SaveOutlined />}
              type="primary"
              disabled={!hasUnsavedChanges}
              onClick={() => setDiffModalOpen(true)}
            />
            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                navigate('/preview');
              }}
            />
          </Space>
        </Flex>
        <Flex
          style={{
            height: 'calc(100vh - 72px)',
          }}
        >
          <Live>
            {editable ? (
              <Splitter layout={isMobile ? 'vertical' : 'horizontal'}>
                <Splitter.Panel
                  defaultSize="50%"
                  min="20%"
                  max="80%"
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
                value={value}
                onChange={setValue}
              />
            )}
          </Live>
        </Flex>
      </Flex>
      <DiffModal
        open={diffModalOpen}
        original={savedValue}
        current={value}
        onConfirm={() => {
          setSavedValue(value);
          setDiffModalOpen(false);
          message.success('Code saved successfully');
        }}
        onCancel={() => setDiffModalOpen(false)}
      />
    </>
  );
};

export default App;
