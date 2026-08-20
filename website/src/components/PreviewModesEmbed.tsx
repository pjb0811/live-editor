import { Suspense, lazy } from 'react';

import BrowserOnly from '@docusaurus/BrowserOnly';

// Code-split via React.lazy (Frame/core pull in ~1.7MB gzipped — see #206)
// and gated behind BrowserOnly, since Frame touches `document.body` during
// render and would crash Docusaurus' Node-side static build otherwise.
const PreviewModesDemo = lazy(() => import('./PreviewModesDemo'));

const fallback = <div style={{ height: 340 }} />;

export default function PreviewModesEmbed(): React.ReactNode {
  return (
    <BrowserOnly fallback={fallback}>
      {() => (
        <Suspense fallback={fallback}>
          <PreviewModesDemo />
        </Suspense>
      )}
    </BrowserOnly>
  );
}
