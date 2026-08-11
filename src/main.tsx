import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import {
  DndCustomRenderDoc,
  DndDoc,
  DocsLayout,
  Editor,
  EditorModeDoc,
  Overview,
  Playground,
  Preview,
  PreviewModesDoc,
} from './pages';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<DocsLayout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/docs/editor-mode" element={<EditorModeDoc />} />
          <Route path="/docs/dnd" element={<DndDoc />} />
          <Route
            path="/docs/dnd/custom-render"
            element={<DndCustomRenderDoc />}
          />
          <Route path="/docs/preview-modes" element={<PreviewModesDoc />} />
        </Route>
        <Route path="/editor" element={<Editor />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/playground" element={<Playground />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
