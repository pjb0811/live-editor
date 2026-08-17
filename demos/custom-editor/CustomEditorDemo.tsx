import { useState } from 'react';

import Context from '~/components/context';
import Editor from '~/components/editor';
import Preview from '~/components/preview';
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

// Custom Editor demo. Mirrors the app's `pages/docs/editor-custom-render`:
// `Editor`'s `renderEditor` fully replaces the built-in CodeMirror surface
// (here a plain <textarea>) while still syncing to the shared preview code.
const CustomEditorDemo = () => {
  const [value, setValue] = useState(SAMPLE_CODE);

  return (
    <Context>
      <div className="grid h-screen grid-cols-1 overflow-y-auto md:grid-cols-2">
        <div
          className={cn(
            'overflow-auto border-b border-gray-200',
            'md:border-r md:border-b-0',
          )}
        >
          <Preview
            showError
            frame={{
              mode: 'iframe',
              syncStyle: true,
              scripts: ['../js/tailwindcss.js'],
            }}
          />
        </div>
        <div className="overflow-auto p-2">
          <Editor
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
    </Context>
  );
};

export default CustomEditorDemo;
