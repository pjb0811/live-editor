import { defineConfig } from 'tsdown';

export default defineConfig({
  // Object form (rather than an array) so each key controls its own output
  // path/subpath — matching package.json's `exports` map — regardless of
  // where the source file actually lives under src/components/. The root
  // entry stays for convenience/backwards compatibility; the rest let a
  // consumer who only needs e.g. Dnd avoid pulling in CodeMirror/Prettier
  // for Editor, or the whole editor stack for Preview. See #194.
  entry: {
    index: 'src/index.tsx',
    'provider/index': 'src/components/context/index.ts',
    'dnd/index': 'src/components/dnd/index.ts',
    'editor/index': 'src/components/editor/index.ts',
    'preview/index': 'src/components/preview/index.ts',
    'error/index': 'src/components/error/index.ts',
    'utils/index': 'src/utils/index.ts',
    'utils/ast/index': 'src/utils/ast/index.ts',
    'utils/tailwind/index': 'src/utils/tailwind/index.ts',
  },
  format: ['esm'],
  // This is a browser UI library (React components, iframe preview). Without
  // an explicit browser platform, bundled deps resolve their Node conditions
  // — e.g. nanoid pulls in `crypto.randomFillSync` and CJS interop injects
  // `createRequire` from `node:module` — which breaks every browser bundler
  // that consumes the built package (rspack/webpack throw on `node:` schemes).
  platform: 'browser',
  dts: { build: true },
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  treeshake: true,
  deps: {
    onlyBundle: [
      /^@babel\//,
      /^@codemirror\//,
      /^@jridgewell\//,
      '@marijn/find-cluster-break',
      'clsx',
      'debug',
      'has-flag',
      'js-tokens',
      'jsesc',
      'ms',
      'nanoid',
      'picocolors',
      'style-mod',
      'supports-color',
      'tailwind-merge',
      'w3c-keyname',
    ],
  },
});
