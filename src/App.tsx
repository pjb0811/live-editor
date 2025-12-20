import { useState } from 'react';

import { SaveOutlined } from '@ant-design/icons';
import { Button, Flex, Radio, Space, Splitter, Switch } from 'antd';
import * as Antd from 'antd';

import './App.css';

import Live from './';
import { DEFAULT_TEMPLATE } from './enums';

const options = [
  { label: 'Drag & Drop', value: 'dnd' },
  { label: 'Editor', value: 'editor' },
];

const App = () => {
  const [value, setValue] = useState(DEFAULT_TEMPLATE);
  const [app, setApp] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [type, setType] = useState<'dnd' | 'editor'>('editor');

  const editable = type === 'editor';

  return (
    <>
      <Flex gap="middle" vertical className="h-full">
        <Flex justify="end">
          <Space className="p-2">
            <Switch
              checkedChildren="app"
              unCheckedChildren="NonApp"
              checked={app}
              onChange={setApp}
            />
            <Switch
              checkedChildren="Mobile"
              unCheckedChildren="PC"
              checked={mobile}
              onChange={setMobile}
            />
            <Radio.Group
              size="small"
              value={type}
              options={options}
              optionType="button"
              buttonStyle="solid"
              onChange={e => setType(e.target.value)}
            />
            <Button icon={<SaveOutlined />} onClick={() => {}} />
          </Space>
        </Flex>
        <Flex flex="1">
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
                      scripts={[
                        '/js/tailwindcss.js',
                        //
                      ]}
                      props={{
                        headers: {
                          isApp: app,
                          isMobile: mobile,
                        },
                      }}
                      modules={{
                        antd: Antd,
                      }}
                    />
                  </div>
                </Splitter.Panel>
                <Splitter.Panel collapsible>
                  <Live.Editor
                    height="100%"
                    value={value}
                    onChange={setValue}
                  />
                </Splitter.Panel>
              </Splitter>
            ) : (
              <Live.Dnd
                value={value}
                props={{
                  headers: {
                    isApp: app,
                    isMobile: mobile,
                  },
                }}
                scripts={['/js/tailwindcss.js']}
                modules={{
                  antd: Antd,
                }}
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
