import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  DesktopOutlined,
  EyeOutlined,
  MobileOutlined,
  RedoOutlined,
  SaveOutlined,
  TabletOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  useDebounce,
  useHistoryState,
  useLocalStorage,
} from '@jbpark/use-hooks';
import {
  Button,
  Flex,
  InputNumber,
  Radio,
  Space,
  Splitter,
  message,
} from 'antd';

import './App.css';

import Live from './';
import { DEFAULT_TEMPLATE, STORAGE_KEY } from './enums';

const options = [
  { label: 'Drag & Drop', value: 'dnd' },
  { label: 'Editor', value: 'editor' },
];

// `null` means no width constraint (fills the panel, i.e. "Desktop").
const VIEWPORT_PRESETS = [
  { label: <DesktopOutlined />, value: null, title: 'Desktop (full width)' },
  { label: <TabletOutlined />, value: 768, title: 'Tablet (768px)' },
  { label: <MobileOutlined />, value: 375, title: 'Mobile (375px)' },
] as const;

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
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  const navigate = useNavigate();

  const editable = type === 'editor';

  const previewFrame = {
    mode: 'iframe' as const,
    syncStyle: true,
    scripts: ['/js/tailwindcss.js'],
    style: viewportWidth
      ? {
          width: viewportWidth,
          margin: '0 auto',
          border: '1px solid #d9d9d9',
        }
      : undefined,
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
  // the editable value.
  useEffect(() => {
    setValue(historyValue);
  }, [historyValue]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (!isMod || e.key.toLowerCase() !== 'z') {
        return;
      }

      const target = e.target as HTMLElement | null;

      if (target?.closest('.cm-editor')) {
        // Let CodeMirror's own text-level undo/redo handle this instead.
        return;
      }

      e.preventDefault();

      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

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
            <Radio.Group
              size="small"
              value={viewportWidth}
              optionType="button"
              buttonStyle="solid"
              onChange={e => setViewportWidth(e.target.value)}
            >
              {VIEWPORT_PRESETS.map(preset => (
                <Radio.Button
                  key={preset.title}
                  value={preset.value}
                  title={preset.title}
                >
                  {preset.label}
                </Radio.Button>
              ))}
            </Radio.Group>
            <InputNumber
              size="small"
              min={200}
              max={2560}
              placeholder="Custom width"
              value={viewportWidth}
              onChange={value => setViewportWidth(value)}
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
              onClick={() => {
                setSavedValue(value);
                message.success('Code saved successfully');
              }}
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
              <Splitter>
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
    </>
  );
};

export default App;
