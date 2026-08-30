import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// `~/index.css` already pulls in @jbpark/ui-kit's stylesheet (properly
// layered — see its own comment) — a separate direct import here duplicated
// it unlayered, ahead of everything else, which is exactly the ordering
// this repo's own layer fix (#259) exists to prevent. Don't re-add it.
import '~/index.css';

import '../shared.css';

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
