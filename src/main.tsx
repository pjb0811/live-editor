import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import App from './App';
import { Intro, Playground, Preview } from './pages';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/editor" element={<App />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/playground" element={<Playground />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
