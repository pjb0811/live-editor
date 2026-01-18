import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Flex, Radio, Space, Splitter, message } from 'antd';

import './App.css';

import Live from './';
import { DEFAULT_TEMPLATE, STORAGE_KEY } from './enums';

const options = [
  { label: 'Drag & Drop', value: 'dnd' },
  { label: 'Editor', value: 'editor' },
];

const App = () => {
  const [value, setValue] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_TEMPLATE,
  );
  const [type, setType] = useState<'dnd' | 'editor'>('editor');

  const navigate = useNavigate();

  const editable = type === 'editor';

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
              icon={<SaveOutlined />}
              type="primary"
              onClick={() => {
                localStorage.setItem(STORAGE_KEY, value);
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
                  <div className="h-full overflow-hidden p-2">
                    <Live.Preview
                      showError
                      iframe
                      scripts={['/js/tailwindcss.js']}
                    />
                  </div>
                </Splitter.Panel>
                <Splitter.Panel collapsible>
                  <Live.Editor value={value} onChange={setValue} />
                </Splitter.Panel>
              </Splitter>
            ) : (
              <Live.Dnd value={value} onChange={setValue} />
            )}
          </Live>
        </Flex>
      </Flex>
    </>
  );
};

export default App;
