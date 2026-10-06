import Preview from '@jbpark/live-editor/preview';
import Context from '@jbpark/live-editor/provider';

import styles from './preview-modes-demo.module.css';

const SAMPLE_CODE = `
import * as ui from 'ui-kit';

const App = () => {
  return (
    <div className="flex flex-col items-start gap-2 p-6">
      <ui.Typography.Title level={4}>Preview Modes</ui.Typography.Title>
      <ui.Button type="primary">A button</ui.Button>
    </div>
  );
};

export default App;
`;

// A Modal and a Drawer portaled into the `container` the preview receives,
// so each opens inside its preview box instead of over the docs page.
const OVERLAYS_CODE = `
import { useState } from 'react';
import * as ui from 'ui-kit';

const App = ({ container }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2 p-6">
      <ui.Button type="primary" onClick={() => setModalOpen(true)}>
        Open modal
      </ui.Button>
      <ui.Button onClick={() => setDrawerOpen(true)}>Open drawer</ui.Button>
      <ui.Modal
        open={modalOpen}
        title="Modal"
        container={container}
        onOk={() => setModalOpen(false)}
        onCancel={() => setModalOpen(false)}
      >
        Opened inside the preview.
      </ui.Modal>
      <ui.Drawer
        open={drawerOpen}
        title="Drawer"
        container={container}
        onClose={() => setDrawerOpen(false)}
      >
        Opened inside the preview.
      </ui.Drawer>
    </div>
  );
};

export default App;
`;

export const SAMPLES = {
  modes: SAMPLE_CODE,
  overlays: OVERLAYS_CODE,
};

export type PreviewModesSample = keyof typeof SAMPLES;

// Rendered directly in the docs page (no DemoFrame/iframe wrapper) — safe
// because this sample has no reader-authored input (it's a fixed string, not
// wired to an editor), so #164's threat model doesn't apply here the way it
// does for the editor-mode/custom-editor/dnd demos. See #206.
const PreviewModesDemo = ({
  sample = 'modes',
}: {
  sample?: PreviewModesSample;
}) => {
  const code = SAMPLES[sample];

  return (
    <div className={styles.grid}>
      <div>
        <div className={styles.label}>iframe</div>
        <div className={styles.box}>
          <Context>
            <Preview
              code={code}
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
              code={code}
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
