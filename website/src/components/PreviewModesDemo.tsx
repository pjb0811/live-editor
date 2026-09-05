import Preview from '@jbpark/live-editor/preview';
import Context from '@jbpark/live-editor/provider';

import styles from './PreviewModesDemo.module.css';

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

// Rendered directly in the docs page (no DemoFrame/iframe wrapper) — safe
// because this sample has no reader-authored input (it's a fixed string, not
// wired to an editor), so #164's threat model doesn't apply here the way it
// does for the editor-mode/custom-editor/dnd demos. See #206.
const PreviewModesDemo = () => {
  return (
    <div className={styles.grid}>
      <div>
        <div className={styles.label}>iframe</div>
        <div className={styles.box}>
          <Context>
            <Preview
              code={SAMPLE_CODE}
              dynamicTailwind
              frame={{ mode: 'iframe', syncStyle: true }}
            />
          </Context>
        </div>
      </div>
      <div>
        <div className={styles.label}>shadow</div>
        <div className={styles.box}>
          <Context>
            <Preview
              code={SAMPLE_CODE}
              dynamicTailwind
              frame={{ mode: 'shadow', syncStyle: true }}
            />
          </Context>
        </div>
      </div>
    </div>
  );
};

export default PreviewModesDemo;
