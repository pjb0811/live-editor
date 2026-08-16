import { useState } from 'react';

import { Space, Typography } from '@jbpark/ui-kit';

import Live from '~/.';
import { cn } from '~/utils';

const SAMPLE_CODE = `
import * as ui from 'ui-kit';

const App = () => {
  return (
    <div className="p-6 space-y-2">
      <ui.Typography.Title level={3}>Hello from the editor</ui.Typography.Title>
      <ui.Button type="primary">Edit me</ui.Button>
    </div>
  );
};

export default App;
`;

const EditorModeDoc = () => {
  const [value, setValue] = useState(SAMPLE_CODE);

  return (
    <div className="space-y-4">
      <Space orientation="vertical" align="start">
        <Typography.Title level={1}>Editor Mode</Typography.Title>
        <Typography.Paragraph className="text-gray-500">
          <code>Live.Editor</code> and <code>Live.Preview</code> share code
          through <code>Live</code>'s context — edit either side, the other
          updates automatically. No manual wiring between them is needed.
        </Typography.Paragraph>
      </Space>
      <Live>
        <div
          className={cn(
            'grid h-[500px] grid-cols-1 gap-4 overflow-hidden rounded-lg',
            'border border-gray-200 md:grid-cols-2',
          )}
        >
          <div
            className={cn(
              'overflow-auto border-b border-gray-200',
              'md:border-r md:border-b-0',
            )}
          >
            <Live.Preview
              showError
              frame={{
                mode: 'iframe',
                syncStyle: true,
                scripts: ['/js/tailwindcss.js'],
              }}
            />
          </div>
          <div className="overflow-auto">
            <Live.Editor value={value} onChange={setValue} />
          </div>
        </div>
      </Live>
    </div>
  );
};

export default EditorModeDoc;
