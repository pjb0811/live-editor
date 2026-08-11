import { Typography } from '@jbpark/ui-kit';

import Live from '~/.';

const SAMPLE_CODE = `
import * as ui from 'ui-kit';

const App = () => {
  return (
    <div className="p-6 space-y-2">
      <ui.Typography.Title level={4}>Preview Modes</ui.Typography.Title>
      <ui.Button type="primary">A button</ui.Button>
    </div>
  );
};

export default App;
`;

const PreviewModesDoc = () => {
  return (
    <div className="space-y-4">
      <div>
        <Typography.Title level={1}>Preview Modes</Typography.Title>
        <Typography.Paragraph className="text-gray-500">
          <code>frame.mode</code> controls how the preview renders:{' '}
          <code>iframe</code> isolates it in a real iframe document (not a
          security sandbox — the code still executes in the host page's JS
          realm), while <code>shadow</code> isolates styles via a shadow DOM
          host in the same document, without an iframe boundary.
        </Typography.Paragraph>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Typography.Title level={4}>iframe</Typography.Title>
          <div
            className="h-64 overflow-hidden rounded-lg border border-gray-200"
          >
            <Live>
              <Live.Preview
                code={SAMPLE_CODE}
                frame={{
                  mode: 'iframe',
                  syncStyle: true,
                  scripts: ['/js/tailwindcss.js'],
                }}
              />
            </Live>
          </div>
        </div>
        <div>
          <Typography.Title level={4}>shadow</Typography.Title>
          <div
            className="h-64 overflow-hidden rounded-lg border border-gray-200"
          >
            <Live>
              <Live.Preview code={SAMPLE_CODE} frame={{ mode: 'shadow' }} />
            </Live>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewModesDoc;
