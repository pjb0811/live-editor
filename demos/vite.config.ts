import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Builds the self-contained docs demos (currently just Drag & Drop) straight
// from the library source into the Docusaurus site's static folder, where each
// demo is embedded via an <iframe>. Reuses the root package's already-installed
// deps and the live-editor source directly (no separate install, no dependency
// on the published `dist`).
export default defineConfig({
  root: fileURLToPath(new URL('./dnd', import.meta.url)),
  // Served from the docs site at `/demos/dnd/`; asset URLs are rewritten to
  // match so the bundle is location-correct once copied into `static/`.
  base: '/demos/dnd/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Same `~` -> src alias the app uses, so the demo can import the library
      // source (`~/.`, `~/constants`) exactly as the in-app pages do.
      '~': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  // The library reads `process.env.NODE_ENV` transitively; stub it like the
  // main app's vite.config does so the browser bundle doesn't choke on it.
  define: {
    'process.env': {},
  },
  // Copy the repo's `public/` (notably `js/tailwindcss.js`, which the preview
  // iframe fetches) into the demo bundle.
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  build: {
    outDir: fileURLToPath(
      new URL('../website/static/demos/dnd', import.meta.url),
    ),
    emptyOutDir: true,
  },
});
