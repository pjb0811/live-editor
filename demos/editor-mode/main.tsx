import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// The editor's stylesheet. `../shared.css` adds ui-kit's.
import '~/index.css';

import '../shared.css';

import EditorModeDemo from './editor-mode-demo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditorModeDemo />
  </StrictMode>,
);
