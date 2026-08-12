import { useState } from 'react';

import { Typography } from '@jbpark/ui-kit';

import Live from '~/.';
import { cn } from '~/utils';

const SAMPLE_CODE = `
import * as ui from 'ui-kit';

const App = () => {
  return (
    <div className="p-6 space-y-2">
      <ui.Typography.Title level={3}>Hello from a custom editor</ui.Typography.Title>
      <ui.Button type="primary">Edit me</ui.Button>
    </div>
  );
};

export default App;
`;

const EditorCustomRenderDoc = () => {
  const [value, setValue] = useState(SAMPLE_CODE);

  return (
    <div className="space-y-4">
      <div>
        <Typography.Title level={1}>Custom Editor</Typography.Title>
        <Typography.Paragraph className="text-gray-500">
          <code>Live.Editor</code> accepts <code>renderEditor</code> to fully
          replace the built-in CodeMirror editing surface — this example uses a
          plain <code>&lt;textarea&gt;</code> — while <code>Live.Editor</code>{' '}
          still syncs to the shared preview code automatically, same as the
          default.
        </Typography.Paragraph>
      </div>
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
          <div className="overflow-auto p-2">
            <Live.Editor
              value={value}
              onChange={setValue}
              renderEditor={({ value: text, onChange }) => (
                <textarea
                  value={text}
                  onChange={e => onChange(e.target.value)}
                  spellCheck={false}
                  className={cn(
                    'h-full w-full resize-none rounded border',
                    'border-gray-200 p-3 font-mono text-sm',
                  )}
                />
              )}
            />
          </div>
        </div>
      </Live>
    </div>
  );
};

export default EditorCustomRenderDoc;
