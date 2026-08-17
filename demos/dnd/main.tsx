import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@jbpark/ui-kit/style.css';

import '~/index.css';

import './demo.css';

import DndDemo from './DndDemo';

// Entry for the self-contained Drag & Drop demo, built into the docs site's
// `static/demos/dnd/` and embedded there via an <iframe>. Keeping it in its own
// bundle is the whole point of approach A: the library's Tailwind + ui-kit
// global styles stay inside this iframe and never leak into Docusaurus' Infima
// theme, and the heavy deps (Babel/AST, dnd-kit) load only when a reader
// actually opens the demo rather than weighing down every docs page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DndDemo />
  </StrictMode>,
);
