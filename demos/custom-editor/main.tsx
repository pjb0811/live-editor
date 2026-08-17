import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@jbpark/ui-kit/style.css';

import '~/index.css';

import '../shared.css';

import CustomEditorDemo from './CustomEditorDemo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomEditorDemo />
  </StrictMode>,
);
