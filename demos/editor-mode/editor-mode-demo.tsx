import { useState } from 'react';

// Import Context + Editor + Preview directly rather than the package default
// (`~/.`), whose namespace also pulls in the Dnd stack this demo never uses.
import Context from '~/components/context';
import Editor from '~/components/editor';
import Preview from '~/components/preview';
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

// Editor Mode demo embedded in the docs' Editor Mode page. Mirrors the app's
// own `pages/docs/editor-mode`: `Editor` and `Preview` share code through
// `Context`, so editing either side updates the other automatically.
const EditorModeDemo = () => {
  const [value, setValue] = useState(SAMPLE_CODE);

  return (
    <Context>
      <div className="grid h-screen grid-cols-1 overflow-hidden md:grid-cols-2">
        <div
          className={cn(
            'overflow-auto border-b border-gray-200',
            'md:border-r md:border-b-0',
          )}
        >
          <Preview
            showError
            frame={{ mode: 'shadow', syncStyle: true }}
            dynamicTailwind
          />
        </div>
        <div className="overflow-auto">
          <Editor value={value} onChange={setValue} />
        </div>
      </div>
    </Context>
  );
};

export default EditorModeDemo;
