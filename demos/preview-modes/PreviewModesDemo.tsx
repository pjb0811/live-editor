import Context from '~/components/context';
import Preview from '~/components/preview';
import { cn } from '~/utils';

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

// Preview Modes demo. Mirrors the app's `pages/docs/preview-modes`: the same
// code rendered through `frame.mode: 'iframe'` (real iframe document) beside
// `frame.mode: 'shadow'` (shadow-DOM host in the same document).
const PreviewModesDemo = () => {
  const label = 'mb-1 text-sm font-semibold text-gray-700';
  const box = cn('h-64 overflow-hidden rounded-lg border border-gray-200');

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
      <div>
        <div className={label}>iframe</div>
        <div className={box}>
          <Context>
            <Preview
              code={SAMPLE_CODE}
              frame={{
                mode: 'iframe',
                syncStyle: true,
                scripts: ['../js/tailwindcss.js'],
              }}
            />
          </Context>
        </div>
      </div>
      <div>
        <div className={label}>shadow</div>
        <div className={box}>
          <Context>
            <Preview code={SAMPLE_CODE} frame={{ mode: 'shadow' }} />
          </Context>
        </div>
      </div>
    </div>
  );
};

export default PreviewModesDemo;
