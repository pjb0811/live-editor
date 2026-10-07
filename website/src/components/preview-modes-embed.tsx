import { Suspense, lazy } from 'react';

import BrowserOnly from '@docusaurus/BrowserOnly';

import type { PreviewModesSample } from './preview-modes-demo';

// Code-split via React.lazy (Frame/core pull in ~1.7MB gzipped — see #206)
// and gated behind BrowserOnly, since Frame touches `document.body` during
// render and would crash Docusaurus' Node-side static build otherwise.
const PreviewModesDemo = lazy(() => import('./preview-modes-demo'));

const fallback = <div style={{ height: 340 }} />;

// `sample` picks the code both previews run (`SAMPLES` in the demo).
export default function PreviewModesEmbed({
  sample,
}: {
  sample?: PreviewModesSample;
}): React.ReactNode {
  return (
    <BrowserOnly fallback={fallback}>
      {() => (
        <Suspense fallback={fallback}>
          <PreviewModesDemo sample={sample} />
        </Suspense>
      )}
    </BrowserOnly>
  );
}
