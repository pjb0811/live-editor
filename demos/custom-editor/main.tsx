import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// `~/index.css` already pulls in @jbpark/ui-kit's stylesheet (properly
// layered — see its own comment) — a separate direct import here duplicated
// it unlayered, ahead of everything else, which is exactly the ordering
// this repo's own layer fix (#259) exists to prevent. Don't re-add it.
import '~/index.css';

import '../shared.css';

import CustomEditorDemo from './CustomEditorDemo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomEditorDemo />
  </StrictMode>,
);
