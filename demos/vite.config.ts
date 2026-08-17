import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Builds the self-contained docs demos (one per interactive docs page) straight
// from the library source into the Docusaurus site's static folder, where each
// demo is embedded via an <iframe>. Reuses the root package's already-installed
// deps and the live-editor source directly (no separate install, no dependency
// on the published `dist`).
//
// A single multi-page build (not one build per demo) so the heavy shared deps
// (Babel/AST, CodeMirror, dnd-kit, ui-kit) are emitted as shared chunks under
// `static/demos/assets/` instead of duplicated into every demo bundle.
export default defineConfig({
  root: r('.'),
  // Relative asset URLs so the built demos work under any Docusaurus baseUrl
  // (GitHub Pages subpath, Vercel root, etc.) without rebuilding.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    // Same `~` -> src alias the app uses, so demos import the library source
    // (`~/components/*`, `~/constants`) exactly as the in-app pages do.
    alias: {
      '~': r('../src'),
    },
  },
  // The library reads `process.env.NODE_ENV` transitively; stub it like the
  // main app's vite.config does so the browser bundle doesn't choke on it.
  define: {
    'process.env': {},
  },
  // Copy the repo's `public/` (notably `js/tailwindcss.js`, which each demo's
  // preview iframe fetches) into the output root — served at `<base>/demos/js/`
  // and referenced from each demo as `../js/tailwindcss.js`.
  publicDir: r('../public'),
  build: {
    outDir: r('../website/static/demos'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dnd: r('dnd/index.html'),
        'editor-mode': r('editor-mode/index.html'),
        'custom-editor': r('custom-editor/index.html'),
        'custom-palette-panel': r('custom-palette-panel/index.html'),
        'preview-modes': r('preview-modes/index.html'),
      },
    },
  },
});
