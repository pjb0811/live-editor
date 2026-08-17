import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.tsx',
    'src/utils/index.ts',
    'src/utils/ast/index.ts',
    'src/utils/tailwind/index.ts',
  ],
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
