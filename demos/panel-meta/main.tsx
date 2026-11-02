import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// The editor's stylesheet. `../shared.css` adds ui-kit's.
import '~/index.css';

import '../shared.css';

import PanelMetaDemo from './panel-meta-demo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PanelMetaDemo />
  </StrictMode>,
);
